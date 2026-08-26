import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOrdineMcpServer, handleMcpRequest } from "../src/mcp/server";

const safe = { mode: "safe", allowWrite: false, allowIrreversible: false } as const;

const fakeApi = {
  get: vi.fn(async () => ({ ok: true as const, data: [{ id: "pipeline-1" }] })),
  post: vi.fn(async () => ({ ok: true as const, data: { id: "created" } })),
  patch: vi.fn(async () => ({ ok: true as const, data: { id: "updated" } })),
  del: vi.fn(async () => ({ ok: true as const, data: undefined })),
};

describe("ORDINE MCP server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("negotiates tools and resources through the official MCP SDK", async () => {
    const server = createOrdineMcpServer({ policy: safe, apiClient: fakeApi });
    const client = new Client({ name: "ordine-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const resources = await client.listResources();
    const context = await client.readResource({ uri: "ordine://workspace/context" });
    const pipelines = await client.callTool({
      name: "ordine.list_pipelines",
      arguments: {},
    });

    expect(tools.tools).toHaveLength(21);
    expect(resources.resources).toHaveLength(6);
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
    expect((listed?.["result"] as { tools: unknown[] }).tools).toHaveLength(21);
  });

  it("allows reads while safe mode blocks writes before the API call", async () => {
    const read = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "ordine.list_pipelines", arguments: {} },
      },
      policy: safe,
      apiClient: fakeApi,
    });
    const write = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "ordine.create_pipeline", arguments: { body: { name: "x" } } },
      },
      policy: safe,
      apiClient: fakeApi,
    });

    expect(read).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(write).toMatchObject({ result: { isError: true } });
    expect(fakeApi.post).not.toHaveBeenCalled();
  });

  it("allows irreversible tools only in explicit yolo mode", async () => {
    const response = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "ordine.delete_job", arguments: { id: "job-1" } },
      },
      policy: { mode: "yolo", allowWrite: false, allowIrreversible: false },
      apiClient: fakeApi,
    });

    expect(response).toMatchObject({ result: { content: [{ type: "text" }] } });
    expect(fakeApi.del).toHaveBeenCalledWith("/api/jobs/job-1");
  });

  it("keeps irreversible tools blocked when only safe write tools are enabled", async () => {
    const response = await handleMcpRequest({
      request: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: { name: "ordine.delete_job", arguments: { id: "job-1" } },
      },
      policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
      apiClient: fakeApi,
    });

    expect(response).toMatchObject({ result: { isError: true } });
    expect(fakeApi.del).not.toHaveBeenCalled();
  });

  it("supports the write-enabled Pipeline smoke path through MCP tools", async () => {
    const apiClient = {
      get: vi.fn(async (path: string) => {
        if (path === "/api/jobs/job-1") {
          return {
            ok: true as const,
            data: {
              id: "job-1",
              status: "done",
              nodeStatuses: { summarize: "done" },
              error: null,
            },
          };
        }
        if (path === "/api/jobs/job-1/traces") {
          return {
            ok: true as const,
            data: [
              { message: "@@NODE_DONE::summarize" },
              { message: "Pipeline complete. Completed (no output-local-path node configured)" },
            ],
          };
        }

        return { ok: true as const, data: [] };
      }),
      post: vi.fn(async (path: string) => {
        if (path === "/api/pipelines/pipeline-1/run") {
          return { ok: true as const, data: { jobId: "job-1" } };
        }
        if (path === "/api/operations") return { ok: true as const, data: { id: "operation-1" } };
        if (path === "/api/pipelines") return { ok: true as const, data: { id: "pipeline-1" } };

        return { ok: false as const, status: 404, message: "not found" };
      }),
      patch: vi.fn(async () => ({ ok: true as const, data: { id: "operation-1" } })),
      del: vi.fn(async () => ({ ok: true as const, data: undefined })),
    };
    const server = createOrdineMcpServer({
      policy: { mode: "safe", allowWrite: true, allowIrreversible: false },
      apiClient,
    });
    const client = new Client({ name: "ordine-smoke-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const createdPipeline = await client.callTool({
      name: "ordine.create_pipeline",
      arguments: { body: { id: "pipeline-1", name: "Smoke" } },
    });
    const createdOperation = await client.callTool({
      name: "ordine.create_operation",
      arguments: { body: { id: "operation-1", name: "Summarize" } },
    });
    const updatedOperation = await client.callTool({
      name: "ordine.update_operation",
      arguments: { id: "operation-1", body: { config: { executor: { type: "script" } } } },
    });
    const run = await client.callTool({
      name: "ordine.run_pipeline",
      arguments: { pipelineId: "pipeline-1" },
    });
    const job = await client.callTool({
      name: "ordine.get_job",
      arguments: { id: "job-1" },
    });
    const traces = await client.callTool({
      name: "ordine.list_job_traces",
      arguments: { id: "job-1" },
    });

    expect(createdPipeline.isError).not.toBe(true);
    expect(createdOperation.isError).not.toBe(true);
    expect(updatedOperation.isError).not.toBe(true);
    expect(run).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("job-1") }],
    });
    expect(job).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining('"done"') }],
    });
    expect(traces).toMatchObject({
      content: [{ type: "text", text: expect.stringContaining("Pipeline complete") }],
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/pipelines", {
      id: "pipeline-1",
      name: "Smoke",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/operations", {
      id: "operation-1",
      name: "Summarize",
    });
    expect(apiClient.patch).toHaveBeenCalledWith("/api/operations/operation-1", {
      config: { executor: { type: "script" } },
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/pipelines/pipeline-1/run", {
      inputPath: undefined,
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/jobs/job-1");
    expect(apiClient.get).toHaveBeenCalledWith("/api/jobs/job-1/traces");

    await client.close();
    await server.close();
  });
});
