import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captureOutputArtifact } from "./captureOutputArtifact";

describe("captureOutputArtifact", () => {
  const ctx = { dir: "" };

  beforeEach(async () => {
    ctx.dir = await mkdtemp(join(tmpdir(), "capture-"));
  });

  afterEach(async () => {
    await rm(ctx.dir, { recursive: true, force: true });
  });

  it("returns null for undefined / missing / empty dirs (no empty artifact)", async () => {
    expect(await captureOutputArtifact(undefined)).toBeNull();
    expect(await captureOutputArtifact(join(ctx.dir, "nope"))).toBeNull();
    expect(await captureOutputArtifact(ctx.dir)).toBeNull();
  });

  it("captures a dir artifact with sorted files, inferred contentType, skipping noise dirs", async () => {
    await mkdir(join(ctx.dir, "components"), { recursive: true });
    await writeFile(join(ctx.dir, "index.html"), "<h1>hi</h1>");
    await writeFile(join(ctx.dir, "components", "Button.vue"), "<template/>");
    await mkdir(join(ctx.dir, "node_modules"), { recursive: true });
    await writeFile(join(ctx.dir, "node_modules", "junk.js"), "noise");

    const artifact = await captureOutputArtifact(ctx.dir, "showcase");

    expect(artifact).not.toBeNull();
    expect(artifact?.kind).toBe("dir");
    expect(artifact?.content).toBe(ctx.dir);
    expect(artifact?.label).toBe("showcase");
    const paths = artifact?.files?.map((f) => f.path) ?? [];
    expect(paths).toContain("index.html");
    expect(paths).toContain(join("components", "Button.vue"));
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
    expect(artifact?.files?.find((f) => f.path === "index.html")?.contentType).toBe("html");
    expect(artifact?.files?.find((f) => f.path.endsWith("Button.vue"))?.contentType).toBe("text");
  });

  it("only captures files written within the execution window (excludes stale residue)", async () => {
    // Stale leftover (other node / earlier run): mtime set far in the past
    await writeFile(join(ctx.dir, "stale.html"), "old");
    const longAgo = new Date(Date.now() - 60_000);
    await utimes(join(ctx.dir, "stale.html"), longAgo, longAgo);

    const sinceMs = Date.now();
    // New file written by this execution
    await writeFile(join(ctx.dir, "fresh.html"), "new");

    const artifact = await captureOutputArtifact(ctx.dir, "node", sinceMs);
    const paths = artifact?.files?.map((f) => f.path) ?? [];
    expect(paths).toContain("fresh.html");
    expect(paths).not.toContain("stale.html");
  });

  it("returns null when only stale residue exists (no spurious attribution)", async () => {
    await writeFile(join(ctx.dir, "stale.html"), "old");
    const longAgo = new Date(Date.now() - 60_000);
    await utimes(join(ctx.dir, "stale.html"), longAgo, longAgo);

    expect(await captureOutputArtifact(ctx.dir, "node", Date.now())).toBeNull();
  });
});
