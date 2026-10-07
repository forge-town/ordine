import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listDirTree } from "../../filesystem.service";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("filesystemService", () => {
  const ctx = { tempDir: "" };
  beforeEach(async () => {
    ctx.tempDir = await mkdtemp(join(tmpdir(), "fs-test-"));
    await mkdir(join(ctx.tempDir, "sub-folder"));
    await writeFile(join(ctx.tempDir, "file.txt"), "hello");
    await writeFile(join(ctx.tempDir, "readme.md"), "world");
  });
  afterEach(async () => {
    await rm(ctx.tempDir, { recursive: true, force: true });
  });
  describe("listDirTree", () => {
    const treeCtx = { dir: "" };

    beforeEach(async () => {
      treeCtx.dir = await mkdtemp(join(tmpdir(), "tree-test-"));
      await mkdir(join(treeCtx.dir, "src", "utils"), { recursive: true });
      await mkdir(join(treeCtx.dir, "node_modules", "pkg"), { recursive: true });
      await mkdir(join(treeCtx.dir, ".git"), { recursive: true });
      await writeFile(join(treeCtx.dir, "src", "index.ts"), "");
      await writeFile(join(treeCtx.dir, "src", "utils", "helper.ts"), "");
      await writeFile(join(treeCtx.dir, "node_modules", "pkg", "index.js"), "");
      await writeFile(join(treeCtx.dir, ".git", "HEAD"), "");
      await writeFile(join(treeCtx.dir, "README.md"), "");
    });

    afterEach(async () => {
      await rm(treeCtx.dir, { recursive: true, force: true });
    });

    it("generates tree string excluding .git and node_modules by default", async () => {
      const tree = await listDirTree(treeCtx.dir);
      expect(tree).toContain("src/");
      expect(tree).toContain("README.md");
      expect(tree).not.toContain(".git");
      expect(tree).not.toContain("node_modules");
    });

    it("excludes paths listed in excludedPaths", async () => {
      const tree = await listDirTree(treeCtx.dir, {
        excludedPaths: ["node_modules"],
      });
      expect(tree).toContain("src/");
      expect(tree).toContain("README.md");
      expect(tree).not.toContain("node_modules");
    });

    it("excludes multiple paths", async () => {
      const tree = await listDirTree(treeCtx.dir, {
        excludedPaths: ["node_modules", "src/utils"],
      });
      expect(tree).toContain("src/");
      expect(tree).toContain("index.ts");
      expect(tree).not.toContain("node_modules");
      expect(tree).not.toContain("utils");
      expect(tree).not.toContain("helper.ts");
    });

    it("respects maxDepth option", async () => {
      const tree = await listDirTree(treeCtx.dir, { maxDepth: 1 });
      expect(tree).toContain("src/");
      expect(tree).not.toContain("index.ts");
      expect(tree).not.toContain("helper.ts");
    });

    it("returns empty string for non-existent directory", async () => {
      const tree = await listDirTree("/nonexistent-abc-123");
      expect(tree).toBe("");
    });
  });
});
