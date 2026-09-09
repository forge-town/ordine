import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/better-auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/integrations/server-env", () => ({
  getServerEnv: () => ({
    ORDINE_AGENT_API_TOKEN: "test-agent-api-token-that-is-long-enough",
    ORDINE_API_PROXY_TARGET: "http://localhost:9433",
    VITE_APP_URL: "http://localhost:9430",
    ORDINE_EXECUTION_API_TARGET: "http://localhost:61943",
    ORDINE_EXECUTION_OWNER_USER_ID: "user-1",
  }),
}));

import { proxyAgentControlApiRequest, proxyOrdineApiRequest } from "./proxyOrdineApiRequest";

describe("proxyOrdineApiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("forwards the request path, query, method, and body to the API server", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "session-1" }, { status: 201 }));
    const request = new Request("http://localhost:9430/api/pipeline-agent-sessions?source=home", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:9430" },
      body: JSON.stringify({ mode: "generate" }),
    });

    const response = await proxyOrdineApiRequest(request);
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;

    expect(response.status).toBe(201);
    expect(forwarded.url).toBe("http://localhost:9433/api/pipeline-agent-sessions?source=home");
    expect(forwarded.method).toBe("POST");
    expect(await forwarded.json()).toEqual({ mode: "generate" });
  });

  it("returns a structured 503 response when the API server cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const response = await proxyOrdineApiRequest(
      new Request("http://localhost:9430/api/pipeline-agent-sessions", {
        method: "POST",
        headers: { Origin: "http://localhost:9430" },
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Ordine API is unavailable. Start the API server and try again.",
    });
  });

  it("degrades an unavailable Agent capabilities probe without emitting a page-level 503", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const response = await proxyOrdineApiRequest(
      new Request("http://localhost:9430/api/agent-threads/capabilities"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ordine-agent-control-state")).toBe("api-unavailable");
    await expect(response.json()).resolves.toEqual({
      enabled: false,
      toolContractVersion: 1,
      toolCount: 22,
      runtimes: [],
    });
  });

  it("requires a web session before proxying Agent Control requests", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const response = await proxyAgentControlApiRequest(
      new Request("http://localhost:9430/api/agent-threads"),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("injects the server-side Agent API token for authenticated requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([]));

    const response = await proxyAgentControlApiRequest(
      new Request("http://localhost:9430/api/agent-threads", {
        headers: { Authorization: "Bearer attacker-controlled" },
      }),
    );
    const forwarded = fetchMock.mock.calls[0]?.[0] as Request;

    expect(response.status).toBe(200);
    expect(forwarded.headers.get("authorization")).toBe(
      "Bearer test-agent-api-token-that-is-long-enough",
    );
  });
  it("rejects a different workspace user and cross-origin mutation before forwarding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    mocks.getSession.mockResolvedValueOnce({ user: { id: "other-user" } });
    expect(
      (await proxyOrdineApiRequest(new Request("http://localhost:9430/api/agent-threads"))).status,
    ).toBe(403);
    expect(
      (
        await proxyOrdineApiRequest(
          new Request("http://localhost:9430/api/agent-threads", {
            method: "POST",
            headers: { Origin: "https://elsewhere.test" },
          }),
        )
      ).status,
    ).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("follows only the same-server Agent event redirect without forwarding browser credentials", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "/api/agent-runs/run-1/events?after=2" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("data: connected\n\n", { headers: { "content-type": "text/event-stream" } }),
      );
    const response = await proxyOrdineApiRequest(
      new Request("http://localhost:9430/api/agent-threads/thread-1/runs/run-1/events", {
        headers: { Cookie: "private-session" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("connected");
    expect(String(fetchMock.mock.calls[1]![0])).toBe(
      "http://localhost:9433/api/agent-runs/run-1/events?after=2",
    );
    expect(new Headers(fetchMock.mock.calls[1]![1]!.headers).has("cookie")).toBe(false);
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://elsewhere.test/steal" } }),
    );
    expect(
      (await proxyOrdineApiRequest(new Request("http://localhost:9430/api/agent-threads"))).status,
    ).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
