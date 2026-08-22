import { describe, expect, it, vi } from "vitest";
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
});
