import { afterEach, describe, expect, it, vi } from "vitest";
import { listMcpToolsHttp } from "./mcpHttpClient";

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

type TestResponseInit = Omit<ResponseInit, "headers"> & { headers?: Record<string, string> };

const jsonResponse = (body: unknown, init?: TestResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });

const sseResponse = (body: unknown, init?: TestResponseInit) =>
  new Response(`event: message\ndata: ${JSON.stringify(body)}\n\n`, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...init?.headers },
    ...init,
  });

describe("listMcpToolsHttp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("completes a streamable HTTP handshake and returns tools", async () => {
    const requests: RequestInit[] = [];
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
    ];
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init) requests.push(init);

      return responses.shift()!;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listMcpToolsHttp({
      url: "https://mcp.example.com/mcp",
      headers: { authorization: "Bearer token" },
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ name: "create_issue", description: "Create issue" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requests[0]!.headers).toEqual(
      expect.objectContaining({
        authorization: "Bearer token",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      }),
    );
    expect(requests[1]!.headers).toEqual(
      expect.objectContaining({ "mcp-session-id": "session-1" }),
    );
    expect(requests[2]!.headers).toEqual(
      expect.objectContaining({ "mcp-session-id": "session-1" }),
    );
  });

  it("parses SSE JSON-RPC responses", async () => {
    const responses = [
      sseResponse({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }),
      new Response(null, { status: 202 }),
      sseResponse({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "read_file" }] } }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responses.shift()!),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/sse" });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([{ name: "read_file" }]);
  });

  it("follows tools/list pagination", async () => {
    const responses = [
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }),
      new Response(null, { status: 202 }),
      jsonResponse({
        jsonrpc: "2.0",
        id: 2,
        result: { tools: [{ name: "first" }], nextCursor: "cursor-1" },
      }),
      jsonResponse({ jsonrpc: "2.0", id: 3, result: { tools: [{ name: "second" }] } }),
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => responses.shift()!),
    );

    const result = await listMcpToolsHttp({ url: "https://mcp.example.com/mcp" });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().map((tool) => tool.name)).toEqual(["first", "second"]);
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
