import { describe, expect, it, vi } from "vitest";
import { createScopedRequest } from "./createScopedRequest";

describe("createScopedRequest", () => {
  it("adds sidecar authentication only to requests under the configured API base", async () => {
    const request = vi.fn().mockResolvedValue(new Response());
    const scopedRequest = createScopedRequest({
      baseUrl: "http://127.0.0.1:9433/api",
      getHeaders: () => ({ "X-Desktop-Token": "desktop-secret" }),
      request,
    });

    await scopedRequest("http://127.0.0.1:9433/api/pipeline-agent-sessions", {
      headers: { "content-type": "application/json" },
    });
    await scopedRequest("https://api.github.com/user", {
      headers: { authorization: "Bearer github-token" },
    });

    const localHeaders = new Headers(request.mock.calls[0]?.[1]?.headers);
    const githubHeaders = new Headers(request.mock.calls[1]?.[1]?.headers);
    expect(localHeaders.get("X-Desktop-Token")).toBe("desktop-secret");
    expect(localHeaders.get("content-type")).toBe("application/json");
    expect(githubHeaders.get("X-Desktop-Token")).toBeNull();
    expect(githubHeaders.get("authorization")).toBe("Bearer github-token");
  });
});
