import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api";

const originalFetch = globalThis.fetch;
const originalToken = process.env.ORDINE_DESKTOP_AUTH_TOKEN;
const originalTokenFile = process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE;
const directories: string[] = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.ORDINE_DESKTOP_AUTH_TOKEN;
  else process.env.ORDINE_DESKTOP_AUTH_TOKEN = originalToken;
  if (originalTokenFile === undefined) delete process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE;
  else process.env.ORDINE_DESKTOP_AUTH_TOKEN_FILE = originalTokenFile;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  vi.restoreAllMocks();
});

describe("desktop token file", () => {
  it("reads the token again for every MCP-backed API request", async () => {
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
    await api.get("/api/jobs");
    await writeFile(tokenFile, "b".repeat(64), "utf8");
    await api.get("/api/jobs");

    expect(tokens).toEqual(["a".repeat(64), "b".repeat(64)]);
  });
});
