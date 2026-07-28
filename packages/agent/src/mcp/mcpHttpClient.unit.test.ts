import { afterEach, describe, expect, it, vi } from "vitest";
import { listMcpToolsHttp } from "./mcpHttpClient";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

type TestResponseInit = Omit<ResponseInit, "headers"> & { headers?: Record<string, string> };

const jsonResponse = (body: unknown, init?: TestResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

const sseResponse = (body: string, init?: TestResponseInit) =>
  new Response(body, {
    status: 200,
    ...init,
    headers: { "content-type": "text/event-stream", ...init?.headers },
  });

const deleteIgnoredResponse = () => new Response(null, { status: 405 });

describe("listMcpToolsHttp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("completes a streamable HTTP handshake, reuses the negotiated version, and deletes the session", async () => {
    const requests: Array<{ url: string | URL | Request; init?: RequestInit }> = [];
    const responses = [
      jsonResponse(
        { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } },
        { headers: { "mcp-session-id": "session-1" } },
      ),
      new Response(null, { status: 202 }),
      jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "create_issue", description: "Create issue" }] },
      }),
      deleteIgnoredResponse(),
    ];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url, init });

      return responses.shift()!;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMcpToolsHttp({
      url: "https://mcp.example.com/mcp",
      headers: { authorization: "Bearer token" },
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ name: "create_issue", description: "Create issue" }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requests[0]!.init?.headers).toEqual(
      expect.objectContaining({
        authorization: "Bearer token",
        accept: "application/json, text/event-stream",
      }),
    );
    expect(requests[1]!.init?.headers).toEqual(
      expect.objectContaining({
        authorization: "Bearer token",
        "MCP-Protocol-Version": "2025-06-18",
        "MCP-Session-Id": "session-1",
      }),
    );
    expect(requests[2]!.init?.headers).toEqual(
      expect.objectContaining({
        "MCP-Protocol-Version": "2025-06-18",
        "MCP-Session-Id": "session-1",
      }),
    );
    expect(requests[3]!.init?.method).toBe("DELETE");
    expect(requests[3]!.init?.headers).toEqual(
      expect.objectContaining({
        "MCP-Protocol-Version": "2025-06-18",
        "MCP-Session-Id": "session-1",
      }),
    );
  });

  it("parses SSE JSON-RPC responses with CRLF, notification-first events, and multi-line data", async () => {
    const initBody = [
      "event: message",
      "data: {",
      'data:   "jsonrpc": "2.0",',
      'data:   "method": "notifications/logging",',
      'data:   "params": {"level": "info"}',
      "data: }",
      "",
      "event: message",
      "data: {",
      'data:   "jsonrpc": "2.0",',
      'data:   "id": 1,',
      'data:   "result": {',
      'data:     "protocolVersion": "2025-06-18"',
      "data:   }",
      "data: }",
      "",
    ].join("\r\n");
    const toolsBody = [
      "event: message",
      "data: {",
      'data:   "jsonrpc": "2.0",',
      'data:   "method": "notifications/progress",',
      'data:   "params": {"progress": 50}',
      "data: }",
      "",
      "event: message",
      'data: {"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"read_file"}]}}',
      "",
    ].join("\r\n");
    const responses = [
      sseResponse(initBody, { headers: { "mcp-session-id": "session-1" } }),
      new Response(null, { status: 202 }),
      sseResponse(toolsBody),
      deleteIgnoredResponse(),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responses.shift()!),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/sse" });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ name: "read_file" }]);
  });

  it("reinitializes once when the session expires mid-handshake", async () => {
    const requests: Array<{ url: string | URL | Request; init?: RequestInit }> = [];
    const responses = [
      jsonResponse(
        { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } },
        { headers: { "mcp-session-id": "session-1" } },
      ),
      new Response("expired", { status: 404 }),
      jsonResponse(
        { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } },
        { headers: { "mcp-session-id": "session-2" } },
      ),
      new Response(null, { status: 202 }),
      jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "read_file" }] },
      }),
      deleteIgnoredResponse(),
    ];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url, init });

      return responses.shift()!;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/mcp" });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ name: "read_file" }]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(requests[2]!.init?.headers).not.toEqual(
      expect.objectContaining({ "MCP-Session-Id": "session-1" }),
    );
    expect(requests[3]!.init?.headers).toEqual(
      expect.objectContaining({
        "MCP-Session-Id": "session-2",
      }),
    );
    expect(requests[5]!.init?.method).toBe("DELETE");
    expect(requests[5]!.init?.headers).toEqual(
      expect.objectContaining({
        "MCP-Session-Id": "session-2",
      }),
    );
  });

  it("returns err on unsupported protocol version", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-11-25" } },
          { headers: { "mcp-session-id": "session-1" } },
        ),
      ),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/mcp" });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("unsupported MCP protocol version");
  });

  it("returns err on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/mcp" });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("HTTP 401");
  });

  it("returns err when tools/list omits the tools array", async () => {
    const responses = [
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }),
      new Response(null, { status: 202 }),
      jsonResponse({ jsonrpc: "2.0", id: 2, result: {} }),
      deleteIgnoredResponse(),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responses.shift()!),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/mcp" });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toContain("tools");
  });
});
