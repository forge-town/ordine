import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdineMcpServer, handleMcpRequest } from "../src/mcp/server";
import { ORDINE_MCP_TOOLS } from "../src/mcp/toolCatalog";
import type { McpPolicy } from "../src/mcp/policy";
import { job } from "./fixtures/execution";
import { api } from "../src/api";

const safe = { mode: "safe", allowWrite: false, allowIrreversible: false } as const;
const write = { ...safe, allowWrite: true };
const requestId = "11111111-1111-4111-8111-111111111111";
const request = { apiVersion: 2, requestId, pipelineId: "pipeline-1", expectedRevision: 1 };
const pending = {
  apiVersion: 2,
  requestId,
  preparedRunId: "prepared-1",
  state: "awaiting_approval",
  approvalId: "approval-1",
  expiresAt: "2026-09-08T12:00:00Z",
};
const fakeApi = {
  get: vi.fn<typeof api.get>(),
  post: vi.fn<typeof api.post>(),
  put: vi.fn<typeof api.put>(),
  getBytes: vi.fn<typeof api.getBytes>(),
};
const call = (name: string, input: unknown = {}, policy: McpPolicy = write) =>
  handleMcpRequest({
    request: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: input } },
    policy,
    apiClient: fakeApi,
  });
beforeEach(() => {
  vi.resetAllMocks();
  fakeApi.get.mockResolvedValue({ ok: true, data: [] });
  fakeApi.post.mockResolvedValue({ ok: true, data: pending });
});

describe("ORDINE execution v2 MCP", () => {
  it("negotiates the v2 catalog and safe read through the official SDK", async () => {
    const server = createOrdineMcpServer({ policy: safe, apiClient: fakeApi });
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(ORDINE_MCP_TOOLS.map((tool) => tool.name));
    expect(tools.tools.every((tool) => tool.name.startsWith("ordine.v2."))).toBe(true);
    expect(tools.tools.some((tool) => /approve|reject/.test(tool.name))).toBe(false);
    expect((await client.listResources()).resources).toHaveLength(2);
    expect(await client.readResource({ uri: "ordine://workspace/context" })).toMatchObject({
      contents: [{ text: expect.stringContaining('"apiVersion": 2') }],
    });
    expect(
      await client.callTool({ name: "ordine.v2.jobs.list", arguments: {} }),
    ).not.toHaveProperty("isError", true);
    expect(fakeApi.get).toHaveBeenCalledWith("/api/v2/jobs");
    await client.close();
    await server.close();
  });
  it("blocks writes under safe policy before calling the API", async () => {
    expect(await call("ordine.v2.run_requests.submit", request, safe)).toMatchObject({
      result: { isError: true },
    });
    expect(fakeApi.post).not.toHaveBeenCalled();
  });
  it("returns awaiting approval immediately with recovery instructions and no poll or approval call", async () => {
    const result = await call("ordine.v2.run_requests.submit", request);
    expect(result).toMatchObject({
      result: {
        structuredContent: { ...pending, nextStep: expect.stringContaining("ORDINE App") },
      },
    });
    expect(fakeApi.post).toHaveBeenCalledOnce();
    expect(fakeApi.post).toHaveBeenCalledWith("/api/v2/run-requests", {
      ...request,
      inputs: {},
      executionOverrides: {},
      deliveryRequirements: [],
    });
    expect(fakeApi.get).not.toHaveBeenCalled();
  });
  it("requires an explicit UUID and rejects legacy fields before network activity", async () => {
    for (const input of [
      { ...request, requestId: undefined },
      { ...request, inputPath: "C:/guess.txt" },
      { ...request, apiVersion: 1 },
    ]) {
      expect(await call("ordine.v2.run_requests.submit", input)).toMatchObject({
        result: { isError: true },
      });
    }
    expect(fakeApi.post).not.toHaveBeenCalled();
  });
  it("never aliases old tools or exposes approval even in yolo mode", async () => {
    for (const name of [
      "ordine.run_pipeline",
      "ordine.search",
      "ordine.create_resource",
      "ordine.v2.run_requests.approve",
      "ordine.v2.run_requests.reject",
    ]) {
      expect(
        await call(name, {}, { mode: "yolo", allowWrite: true, allowIrreversible: true }),
      ).toMatchObject({ result: { isError: true } });
    }
    expect(fakeApi.post).not.toHaveBeenCalled();
  });
  it("preserves requestId recovery after timeout without retries", async () => {
    fakeApi.post.mockResolvedValue({
      ok: false,
      status: 0,
      code: "API_NETWORK_ERROR",
      message: "timeout",
    });
    expect(await call("ordine.v2.run_requests.submit", request)).toMatchObject({
      result: {
        isError: true,
        content: [{ text: expect.stringContaining(`requestId=${requestId}`) }],
      },
    });
    expect(fakeApi.post).toHaveBeenCalledOnce();
    expect(fakeApi.get).not.toHaveBeenCalled();
    fakeApi.get.mockResolvedValue({
      ok: true,
      data: {
        apiVersion: 2,
        requestId,
        preparedRunId: "prepared-1",
        state: "accepted",
        jobId: "job-1",
        acceptedAt: "2026-09-08T12:00:00Z",
      },
    });
    expect(await call("ordine.v2.run_requests.get", { requestId })).toMatchObject({
      result: { structuredContent: { state: "accepted", jobId: "job-1" } },
    });
    expect(fakeApi.get).toHaveBeenCalledWith(`/api/v2/run-requests/${requestId}`);
  });
  it("passes event cursors, control and checkpoint paths explicitly", async () => {
    fakeApi.post.mockResolvedValue({ ok: true, data: job });
    await call("ordine.v2.jobs.events", { jobId: "job-1", afterSequence: 7, limit: 25 });
    expect(fakeApi.get).toHaveBeenCalledWith("/api/v2/jobs/job-1/events?afterSequence=7&limit=25");
    await call("ordine.v2.jobs.control", { jobId: "job-1", action: "pause" });
    expect(fakeApi.post).toHaveBeenCalledWith("/api/v2/jobs/job-1/control", { action: "pause" });
    await call("ordine.v2.jobs.checkpoint_ack", { jobId: "job-1", nodeId: "node-1" });
    expect(fakeApi.post).toHaveBeenCalledWith("/api/v2/jobs/job-1/checkpoints/node-1/ack", {});
    expect(
      await call("ordine.v2.jobs.control", { jobId: "job-1", action: "approve" }),
    ).toMatchObject({ result: { isError: true } });
  });
  it("delivers exact binary bytes as base64 and rejects oversized ranges", async () => {
    fakeApi.getBytes.mockResolvedValue({ ok: true, data: Uint8Array.from([0, 255, 128]) });
    expect(
      await call("ordine.v2.artifacts.content", { id: "artifact-1", offset: 2, length: 3 }),
    ).toMatchObject({
      result: { structuredContent: { offset: 2, sizeBytes: 3, contentBase64: "AP+A" } },
    });
    expect(fakeApi.getBytes).toHaveBeenCalledWith(
      "/api/v2/artifacts/artifact-1/content?offset=2&length=3",
    );
    expect(
      await call("ordine.v2.artifacts.content", { id: "artifact-1", length: 2 }),
    ).toMatchObject({ result: { isError: true } });
  });
  it("rejects artifact paths, invalid base64, oversized imports and invalid cursors", async () => {
    for (const input of [
      { name: "../x", contentBase64: "eA==" },
      { name: "x", contentBase64: "not base64" },
      { name: "x", contentBase64: Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64") },
    ]) {
      expect(
        await call("ordine.v2.input_assets.import", {
          importRequestId: requestId,
          mimeType: "text/plain",
          ...input,
        }),
      ).toMatchObject({ result: { isError: true } });
    }
    expect(
      await call("ordine.v2.jobs.events", { jobId: "../jobs", afterSequence: -1 }),
    ).toMatchObject({ result: { isError: true } });
    expect(fakeApi.post).not.toHaveBeenCalled();
    expect(fakeApi.get).not.toHaveBeenCalled();
  });
});
