import { describe, expect, it, vi } from "vitest";
import { createDesktopPlatform, createDesktopRequest } from "./platform";

const credentials = { baseUrl: "http://127.0.0.1:19433", appToken: "test-app-session-token" };
describe("Desktop single-origin API requests", () => {
  it.each(["/api/operations", "/api/agent-control/sessions", "/api/v2/run-requests"])(
    "authenticates %s on the same owner",
    async (path) => {
      const fetcher = vi.fn(async () => new Response("{}"));
      await createDesktopRequest(credentials, fetcher)(`${credentials.baseUrl}${path}`, {
        headers: { "Content-Type": "application/json", "X-Desktop-Token": "caller-value" },
        redirect: "follow",
      });
      const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(call[0]).toBe(`${credentials.baseUrl}${path}`);
      expect(new Headers(call[1].headers).get("X-Desktop-Token")).toBe(credentials.appToken);
      expect(new Headers(call[1].headers).get("X-Ordine-Api-Version")).toBe("2");
      expect(call[1].redirect).toBe("error");
    },
  );
  it.each([
    "https://example.com/api/jobs",
    "http://127.0.0.1:9433/api/jobs",
    "http://127.0.0.1:19433/health",
    "http://user:password@127.0.0.1:19433/api/jobs",
    "http://127.0.0.1:19433/api/../private",
  ])("rejects %s before network access", async (url) => {
    const fetcher = vi.fn(async () => new Response("{}"));
    await expect(createDesktopRequest(credentials, fetcher)(url)).rejects.toThrow(
      "this instance's API",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses the authoring API as the original Platform root", () => {
    expect(createDesktopPlatform(credentials).apiBaseUrl).toBe(`${credentials.baseUrl}/api`);
  });
});
