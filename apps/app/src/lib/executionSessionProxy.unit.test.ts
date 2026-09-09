import { describe, expect, it, vi } from "vitest";
import { createExecutionSessionProxy } from "./executionSessionProxy";

const origin = "http://127.0.0.1:9450";
const token = "test-only-server-app-token-00000000000000";
const setup = (userId: string | null = "owner") => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
    new Response("artifact", {
      status: 206,
      headers: { "Content-Range": "bytes 0-7/8", "Set-Cookie": "upstream=private" },
    }),
  );
  const readToken = vi.fn().mockResolvedValue(token);
  const proxy = createExecutionSessionProxy({
    origin,
    target: "http://127.0.0.1:61943",
    transport: "desktop",
    ownerUserId: "owner",
    getSessionUserId: async () => userId,
    readToken,
    fetcher,
  });

  return { proxy, fetcher, readToken };
};

describe("execution session proxy", () => {
  it.each([
    [null, 401],
    ["another-user", 403],
  ] as const)(
    "rejects session %s before reading credentials or forwarding",
    async (userId, status) => {
      const { proxy, fetcher, readToken } = setup(userId);
      expect((await proxy(new Request(`${origin}/api/v2/readiness`))).status).toBe(status);
      expect(readToken).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, "https://untrusted.example"])(
    "rejects mutation origin %s",
    async (source) => {
      const { proxy, fetcher } = setup();
      const response = await proxy(
        new Request(`${origin}/api/v2/approvals/test/approve`, {
          method: "POST",
          headers: source ? { Origin: source } : {},
          body: "{}",
        }),
      );
      expect(response.status).toBe(403);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("forwards an owner request with server credentials and preserves binary ranges", async () => {
    const { proxy, fetcher } = setup();
    const response = await proxy(
      new Request(`${origin}/api/v2/artifacts/example/content?offset=0`, {
        headers: {
          Cookie: "session=private",
          Authorization: "Bearer attacker",
          "X-Desktop-Token": "attacker",
          Range: "bytes=0-7",
        },
      }),
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("http://127.0.0.1:61943/api/v2/artifacts/example/content?offset=0");
    const headers = new Headers(init!.headers);
    expect(headers.get("X-Desktop-Token")).toBe(token);
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("Cookie")).toBeNull();
    expect(headers.get("X-Ordine-Api-Version")).toBe("2");
    expect(headers.get("Range")).toBe("bytes=0-7");
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-7/8");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    expect(await response.text()).toBe("artifact");
  });

  it("forwards the exact approved body without redirecting", async () => {
    const { proxy, fetcher } = setup();
    await proxy(
      new Request(`${origin}/api/v2/approvals/test/approve`, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: '{"preparedHash":"exact-content"}',
      }),
    );
    const [, init] = fetcher.mock.calls[0]!;
    expect(init!.redirect).toBe("error");
    expect(await new Response(init!.body).text()).toBe('{"preparedHash":"exact-content"}');
  });
});
