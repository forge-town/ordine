import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listDirectory, listDirTree } from "./filesystemService";
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

  describe("listDirectory", () => {
    it("returns entries with name, type, and path", async () => {
      const result = await listDirectory(ctx.tempDir);

      expect(result.isOk()).toBe(true);
      const entries = result._unsafeUnwrap();

      expect(entries).toHaveLength(3);

      const folder = entries.find((e) => e.name === "sub-folder");
      expect(folder).toMatchObject({
        name: "sub-folder",
        type: "directory",
        path: join(ctx.tempDir, "sub-folder"),
      });

      const file = entries.find((e) => e.name === "file.txt");
      expect(file).toMatchObject({
        name: "file.txt",
        type: "file",
        path: join(ctx.tempDir, "file.txt"),
      });
    });

    it("sorts directories before files", async () => {
      const result = await listDirectory(ctx.tempDir);
      const entries = result._unsafeUnwrap();

      const types = entries.map((e) => e.type);
      const firstFileIndex = types.indexOf("file");
      const lastDirIndex = types.lastIndexOf("directory");

      expect(lastDirIndex).toBeLessThan(firstFileIndex);
    });

    it("defaults to home directory when no path given", async () => {
      const result = await listDirectory();

      expect(result.isOk()).toBe(true);
      const entries = result._unsafeUnwrap();
      expect(entries.length).toBeGreaterThan(0);
    });

    it("returns error for non-existent path", async () => {
      const result = await listDirectory("/nonexistent-path-abc123");

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("DirectoryNotFound");
    });

    it("returns error for a file path (not directory)", async () => {
      const result = await listDirectory(join(ctx.tempDir, "file.txt"));

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("NotADirectory");
    });
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
