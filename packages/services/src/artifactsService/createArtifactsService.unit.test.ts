import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createArtifactsService } from "./createArtifactsService";

describe("artifactsService", () => {
  const svc = createArtifactsService();
  const ctx = { root: "", outside: "" };

  beforeEach(async () => {
    ctx.root = await mkdtemp(join(tmpdir(), "artifact-root-"));
    ctx.outside = await mkdtemp(join(tmpdir(), "artifact-outside-"));
    await mkdir(join(ctx.root, "components"), { recursive: true });
    await writeFile(join(ctx.root, "index.html"), "<h1>hi</h1>");
    await writeFile(join(ctx.root, "components", "Button.vue"), "<template/>");
    await writeFile(join(ctx.root, "components", "tokens.css"), ":root{}");
    await mkdir(join(ctx.root, "node_modules"), { recursive: true });
    await writeFile(join(ctx.root, "node_modules", "junk.js"), "noise");
    await writeFile(join(ctx.outside, "secret.txt"), "do-not-read");
  });

  afterEach(async () => {
    await rm(ctx.root, { recursive: true, force: true });
    await rm(ctx.outside, { recursive: true, force: true });
  });

  it("lists files recursively with content types, skipping noise dirs", async () => {
    const files = await svc.listDir({ allowedRoots: [ctx.root], dirPath: ctx.root });
    const paths = files.map((f) => f.path);
    expect(paths).toContain("index.html");
    expect(paths).toContain(join("components", "Button.vue"));
    expect(paths.some((p) => p.includes("node_modules"))).toBe(false);
    expect(files.find((f) => f.path === "index.html")?.contentType).toBe("html");
    expect(files.find((f) => f.path.endsWith("Button.vue"))?.contentType).toBe("text");
  });

  it("reads a file's content and guessed contentType", async () => {
    const out = await svc.readFile({
      allowedRoots: [ctx.root],
      filePath: join(ctx.root, "index.html"),
    });
    expect(out.content).toBe("<h1>hi</h1>");
    expect(out.contentType).toBe("html");
    expect(out.truncated).toBe(false);
  });

  it("rejects reading a path outside the allowed roots (anti-traversal)", async () => {
    await expect(
      svc.readFile({
        allowedRoots: [ctx.root],
        filePath: join(ctx.outside, "secret.txt"),
      }),
    ).rejects.toThrow(/outside the allowed/);
  });

  it("rejects a ../ escape that resolves outside the root", async () => {
    await expect(
      svc.listDir({
        allowedRoots: [ctx.root],
        dirPath: join(ctx.root, "..", "artifact-outside-escape-nope"),
      }),
    ).rejects.toThrow();
  });
});
