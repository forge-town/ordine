import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/server-env", () => ({
  getServerEnv: () => ({ ORDINE_API_PROXY_TARGET: "http://localhost:9433" }),
}));

import { proxyOrdineApiRequest } from "./proxyOrdineApiRequest";

describe("proxyOrdineApiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards the request path, query, method, and body to the API server", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "session-1" }, { status: 201 }));
    const request = new Request("http://localhost:9430/api/pipeline-agent-sessions?source=home", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      new Request("http://localhost:9430/api/pipeline-agent-sessions", { method: "POST" }),
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
});
