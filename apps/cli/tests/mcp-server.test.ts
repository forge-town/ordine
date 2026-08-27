import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdineMcpServer, handleMcpRequest } from "../src/mcp/server";

const safe = { mode: "safe", allowWrite: false, allowIrreversible: false } as const;

const fakeApi = {
  get: vi.fn(async () => ({ ok: true as const, data: [{ id: "pipeline-1" }] })),
  post: vi.fn(async () => ({
    ok: true as const,
    data: {
      actionId: "action-1",
      status: "succeeded",
      resources: [],
      summary: "done",
      warnings: [],
    },
  })),
  patch: vi.fn(async () => ({ ok: true as const, data: { id: "updated" } })),
  del: vi.fn(async () => ({ ok: true as const, data: undefined })),
};

beforeEach(() => vi.clearAllMocks());

describe("ORDINE MCP server", () => {
  it("negotiates tools and resources through the official MCP SDK", async () => {
    const server = createOrdineMcpServer({ policy: safe, apiClient: fakeApi });
    const client = new Client({ name: "ordine-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const context = await client.readResource({ uri: "ordine://workspace/context" });
    const pipelines = await client.callTool({
      name: "ordine.search",
      arguments: { query: "pipeline" },
    });

    expect(tools.tools).toHaveLength(22);
    expect(resources.resources).toHaveLength(2);
    expect(context.contents[0]).toMatchObject({
      uri: "ordine://workspace/context",
      mimeType: "application/json",
    });
    expect(pipelines).toMatchObject({ content: [{ type: "text" }] });

    await client.close();
    await server.close();
  });

  it("negotiates MCP and publishes the full risk-annotated tool catalog", async () => {
    const initialized = await handleMcpRequest({
      request: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      policy: safe,
      apiClient: fakeApi,
    });
    const listed = await handleMcpRequest({
      request: { jsonrpc: "2.0", id: 2, method: "tools/list" },
      policy: safe,
      apiClient: fakeApi,
    });

    expect(initialized).toMatchObject({ result: { serverInfo: { name: "ordine" } } });
    expect(listed).toMatchObject({ result: { tools: expect.any(Array) } });
    expect((listed?.["result"] as { tools: unknown[] }).tools).toHaveLength(22);
  });

  it("allows reads while safe mode blocks writes before the API call", async () => {
    const read = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "ordine.search", arguments: { query: "pipeline" } },
      },
      policy: safe,
      apiClient: fakeApi,
    });
    const write = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "ordine.create_resource",
          arguments: {
            callId: "create-1",
            resourceType: "pipeline",
            data: { name: "x" },
          },
        },
      },
      policy: safe,
      apiClient: fakeApi,
    });

    expect(read).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(write).toMatchObject({ result: { isError: true } });
    expect(fakeApi.post).toHaveBeenCalledTimes(1);
  });

  it("allows irreversible tools only in explicit yolo mode", async () => {
    const response = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "ordine.delete_resource",
          arguments: { callId: "delete-1", resourceType: "skill", id: "skill-1" },
        },
      },
      policy: { mode: "yolo", allowWrite: false, allowIrreversible: false },
      apiClient: fakeApi,
    });

    expect(response).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(fakeApi.post).toHaveBeenCalledWith("/api/agent-control/tools/call", {
      name: "ordine.delete_resource",
      input: { callId: "delete-1", resourceType: "skill", id: "skill-1" },
    });
  });

  it("keeps irreversible tools blocked when only reversible writes are enabled", async () => {
    const response = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "ordine.delete_resource",
          arguments: {
            callId: "delete-blocked-1",
            resourceType: "skill",
            id: "skill-1",
          },
        },
      },
      policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
      apiClient: fakeApi,
    });

    expect(response).toMatchObject({ result: { isError: true } });
    expect(fakeApi.post).not.toHaveBeenCalled();
  });

  it("supports the write-enabled Agent Control smoke path through MCP tools", async () => {
    const server = createOrdineMcpServer({
      policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
      apiClient: fakeApi,
    });
    const client = new Client({ name: "ordine-smoke-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const createdPipeline = await client.callTool({
      name: "ordine.create_resource",
      arguments: {
        callId: "create-pipeline-1",
        resourceType: "pipeline",
        data: { id: "pipeline-1", name: "Smoke" },
      },
    });
    const createdOperation = await client.callTool({
      name: "ordine.create_resource",
      arguments: {
        callId: "create-operation-1",
        resourceType: "operation",
        data: { id: "operation-1", name: "Summarize" },
      },
    });
    const updatedOperation = await client.callTool({
      name: "ordine.update_resource",
      arguments: {
        callId: "update-operation-1",
        resourceType: "operation",
        id: "operation-1",
        patch: { config: { executor: { type: "script" } } },
      },
    });
    const run = await client.callTool({
      name: "ordine.run_pipeline",
      arguments: { callId: "run-pipeline-1", pipelineId: "pipeline-1" },
    });
    const traces = await client.callTool({
      name: "ordine.get_job_trace",
      arguments: { jobId: "job-1", limit: 10 },
    });

    expect(createdPipeline.isError).not.toBe(true);
    expect(createdOperation.isError).not.toBe(true);
    expect(updatedOperation.isError).not.toBe(true);
    expect(run.isError).not.toBe(true);
    expect(traces.isError).not.toBe(true);
    expect(fakeApi.post).toHaveBeenCalledWith("/api/agent-control/tools/call", {
      name: "ordine.create_resource",
      input: {
        callId: "create-pipeline-1",
        resourceType: "pipeline",
        data: { id: "pipeline-1", name: "Smoke" },
      },
    });
    expect(fakeApi.post).toHaveBeenCalledWith("/api/agent-control/tools/call", {
      name: "ordine.run_pipeline",
      input: { callId: "run-pipeline-1", pipelineId: "pipeline-1" },
    });
    expect(fakeApi.post).toHaveBeenCalledWith("/api/agent-control/tools/call", {
      name: "ordine.get_job_trace",
      input: { jobId: "job-1", limit: 10 },
    });

    await client.close();
    await server.close();
  });
});
