import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { probeRuntimePath } from "./scanRuntimes";

describe("explicit executable path probe", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("launches the saved absolute executable with an empty PATH", async () => {
    vi.stubEnv("PATH", "");
    const result = await probeRuntimePath(process.execPath);
    expect(result?.path).toBe(process.execPath);
    expect(result?.version).toBeTruthy();
  });

  it("rejects a missing saved executable without PATH lookup", async () => {
    expect(
      await probeRuntimePath(join(tmpdir(), crypto.randomUUID(), "codex.exe")),
    ).toBeUndefined();
    expect(await probeRuntimePath("codex")).toBeUndefined();
  });

  it("rejects a directory even though it is accessible", async () => {
    expect(await probeRuntimePath(tmpdir())).toBeUndefined();
  });
});
