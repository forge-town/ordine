import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api";

const originalFetch = globalThis.fetch;
const originalToken = process.env.ORDINE_DESKTOP_AUTH_TOKEN;
const originalTokenFile = process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE;
const directories: string[] = [];

beforeEach(() => {
  for (const key of [
    "ORDINE_AUTH_MODE",
    "ORDINE_AGENT_API_TOKEN",
    "ORDINE_AGENT_API_TOKEN_FILE",
    "ORDINE_DESKTOP_AUTH_TOKEN",
    "ORDINE_DESKTOP_AUTH_TOKEN_FILE",
  ])
    vi.stubEnv(key, undefined);
  vi.stubEnv("ORDINE_API_URL", "http://127.0.0.1:9433");
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.ORDINE_DESKTOP_AUTH_TOKEN;
  else process.env.ORDINE_DESKTOP_AUTH_TOKEN = originalToken;
  if (originalTokenFile === undefined) delete process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE;
  else process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE = originalTokenFile;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("desktop token file", () => {
  it("sends the execution API version only for v2 paths", async () => {
    vi.stubEnv("ORDINE_AGENT_API_TOKEN", "a".repeat(32));
    const versions: Array<string | null> = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      versions.push(new Headers(init?.headers).get("X-Ordine-Api-Version"));
      return new Response("{}");
    }) as typeof fetch;
    await api.get("/api/v2/readiness");
    await api.post("/api/v2/run-requests", {});
    await api.get("/api/skills");
    expect(versions).toEqual(["2", "2", null]);
  });
  it("reads the token again for every MCP-backed API request", async () => {
    vi.stubEnv("ORDINE_AUTH_MODE", "desktop");
    const directory = await mkdtemp(join(tmpdir(), "ordine-token-"));
    directories.push(directory);
    const tokenFile = join(directory, ".desktop-token");
    process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE = tokenFile;
    delete process.env.ORDINE_DESKTOP_AUTH_TOKEN;
    const tokens: string[] = [];
    globalThis.fetch = vi.fn(async (_url, init) => {
      tokens.push(new Headers(init?.headers).get("X-Desktop-Token") ?? "");
      return new Response(JSON.stringify([]));
    }) as typeof fetch;

    await writeFile(tokenFile, "a".repeat(64), "utf8");
    await api.get("/api/v2/jobs");
    await writeFile(tokenFile, "b".repeat(64), "utf8");
    await api.get("/api/v2/jobs");

    expect(tokens).toEqual(["a".repeat(64), "b".repeat(64)]);
  });

  it.each(["bearer", "desktop"])(
    "authenticates every HTTP method with only the selected %s identity",
    async (mode) => {
      vi.stubEnv("ORDINE_AUTH_MODE", mode);
      vi.stubEnv("ORDINE_AGENT_API_TOKEN", "a".repeat(32));
      vi.stubEnv("ORDINE_DESKTOP_AUTH_TOKEN", "b".repeat(32));
      const fetcher = vi.fn(async () => new Response("{}"));
      globalThis.fetch = fetcher as typeof fetch;
      const results = await Promise.all([
        api.get("/a"),
        api.post("/a", {}),
        api.put("/a", {}),
        api.patch("/a", {}),
        api.del("/a"),
        api.getBytes("/a"),
      ]);
      expect(results.every((result) => result.ok)).toBe(true);
      for (const [, init] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
        const headers = new Headers(init.headers);
        expect(headers.get("Authorization")).toBe(
          mode === "bearer" ? `Bearer ${"a".repeat(32)}` : null,
        );
        expect(headers.get("X-Desktop-Token")).toBe(mode === "desktop" ? "b".repeat(32) : null);
        expect(init.redirect).toBe("manual");
        expect(init.signal).toBeInstanceOf(AbortSignal);
      }
    },
  );

  it("defaults to bearer and fails before fetching when it is missing", async () => {
    vi.stubEnv("ORDINE_DESKTOP_AUTH_TOKEN", "b".repeat(32));
    const fetcher = vi.fn();
    globalThis.fetch = fetcher;
    expect(await api.get("/a")).toMatchObject({
      ok: false,
      status: 0,
      code: "AUTH_NOT_CONFIGURED",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["bearer", "desktop"])(
    "rejects conflicting %s token sources without reading or sending them",
    async (mode) => {
      const prefix = mode === "bearer" ? "ORDINE_AGENT_API_TOKEN" : "ORDINE_DESKTOP_AUTH_TOKEN";
      vi.stubEnv("ORDINE_AUTH_MODE", mode);
      vi.stubEnv(prefix, "a".repeat(32));
      vi.stubEnv(`${prefix}_FILE`, "missing-file");
      const fetcher = vi.fn();
      globalThis.fetch = fetcher;
      expect(await api.get("/a")).toMatchObject({ ok: false, code: "AUTH_CONFIG_CONFLICT" });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("rejects unreadable, empty and malformed token files then observes a valid rotation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ordine-auth-"));
    directories.push(directory);
    const tokenFile = join(directory, "test-token");
    vi.stubEnv("ORDINE_AGENT_API_TOKEN_FILE", tokenFile);
    const fetcher = vi.fn(async () => new Response("{}"));
    globalThis.fetch = fetcher as typeof fetch;
    expect(await api.get("/a")).toMatchObject({ ok: false, code: "AUTH_FILE_UNREADABLE" });
    for (const invalid of ["", "short", "a".repeat(32) + "\nsecond-line", "a".repeat(32) + " "]) {
      await writeFile(tokenFile, invalid, "utf8");
      expect(await api.get("/a")).toMatchObject({ ok: false, code: "AUTH_TOKEN_INVALID" });
    }
    expect(fetcher).not.toHaveBeenCalled();
    for (const value of ["c".repeat(32), "d".repeat(32)]) {
      await writeFile(tokenFile, value + "\n", "utf8");
      expect((await api.get("/a")).ok).toBe(true);
      expect(
        new Headers((fetcher.mock.calls.at(-1) as unknown as [string, RequestInit])[1].headers).get(
          "Authorization",
        ),
      ).toBe(`Bearer ${value}`);
    }
  });

  it.each([
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com?x=1",
    "https://example.com#fragment",
    "https://example.com?",
    "https://example.com#",
    "file:///tmp/a",
    "not-a-url",
  ])("rejects unsafe API URL %s without fetching", async (url) => {
    vi.stubEnv("ORDINE_API_URL", url);
    vi.stubEnv("ORDINE_AGENT_API_TOKEN", "a".repeat(32));
    const fetcher = vi.fn();
    globalThis.fetch = fetcher;
    expect(await api.get("/a")).toMatchObject({ ok: false, code: "API_CONFIG_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns bounded errors for redirects, network failures, malformed JSON and reflected secrets", async () => {
    const token = "a".repeat(32);
    vi.stubEnv("ORDINE_AGENT_API_TOKEN", token);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: "https://other.example" } }),
    ) as typeof fetch;
    expect(await api.get("/a")).toMatchObject({
      ok: false,
      status: 302,
      code: "API_REDIRECT_BLOCKED",
    });
    globalThis.fetch = vi.fn(async () => {
      throw new Error(token);
    }) as typeof fetch;
    expect(await api.get("/a")).toMatchObject({ ok: false, code: "API_NETWORK_ERROR" });
    globalThis.fetch = vi.fn(async () => new Response("not JSON")) as typeof fetch;
    expect(await api.get("/a")).toMatchObject({ ok: false, code: "API_RESPONSE_INVALID" });
    globalThis.fetch = vi.fn(
      async () => new Response(token + "x".repeat(4000), { status: 401 }),
    ) as typeof fetch;
    const denied = await api.get("/a");
    expect(denied).toMatchObject({ ok: false, status: 401, code: "API_UNAUTHORIZED" });
    expect(JSON.stringify(denied)).not.toContain(token);
    if (!denied.ok) expect(denied.message.length).toBeLessThanOrEqual(512);
  });
  it("preserves typed v2 errors while redacting reflected credentials", async () => {
    const token = "a".repeat(32);
    vi.stubEnv("ORDINE_AGENT_API_TOKEN", token);
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "REVISION_CONFLICT",
              message: `Conflict ${token}`,
              retryable: false,
              stage: "preparation",
              requestId: "request-1",
              field: "expectedRevision",
            },
          }),
          { status: 409 },
        ),
    ) as typeof fetch;
    const result = await api.post("/api/v2/run-requests", {});
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "REVISION_CONFLICT",
      error: {
        code: "REVISION_CONFLICT",
        stage: "preparation",
        retryable: false,
        field: "expectedRevision",
      },
    });
    expect(JSON.stringify(result)).not.toContain(token);
    for (const body of ["null", "[]", "{invalid"]) {
      globalThis.fetch = vi.fn(async () => new Response(body, { status: 500 })) as typeof fetch;
      expect(await api.get("/api/v2/jobs")).toMatchObject({
        ok: false,
        code: "API_HTTP_ERROR",
        status: 500,
      });
    }
  });
  it("rejects execution JSON above 12 MiB before sending it", async () => {
    vi.stubEnv("ORDINE_AGENT_API_TOKEN", "a".repeat(32));
    const fetcher = vi.fn();
    globalThis.fetch = fetcher;
    expect(
      await api.post("/api/v2/run-requests", { value: "x".repeat(12 * 1024 * 1024) }),
    ).toMatchObject({ ok: false, code: "API_REQUEST_INVALID" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
