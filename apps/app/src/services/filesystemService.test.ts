import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listDirectory, listDirTree } from "./filesystemService";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("filesystemService", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "fs-test-"));
    await mkdir(join(tempDir, "sub-folder"));
    await writeFile(join(tempDir, "file.txt"), "hello");
    await writeFile(join(tempDir, "readme.md"), "world");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("listDirectory", () => {
    it("returns entries with name, type, and path", async () => {
      const result = await listDirectory(tempDir);

      expect(result.isOk()).toBe(true);
      const entries = result._unsafeUnwrap();

      expect(entries).toHaveLength(3);

      const folder = entries.find((e) => e.name === "sub-folder");
      expect(folder).toMatchObject({
        name: "sub-folder",
        type: "directory",
        path: join(tempDir, "sub-folder"),
      });

      const file = entries.find((e) => e.name === "file.txt");
      expect(file).toMatchObject({
        name: "file.txt",
        type: "file",
        path: join(tempDir, "file.txt"),
      });
    });

    it("sorts directories before files", async () => {
      const result = await listDirectory(tempDir);
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
      const result = await listDirectory(join(tempDir, "file.txt"));

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.type).toBe("NotADirectory");
    });
  });

  describe("listDirTree", () => {
    let treeDir: string;

    beforeEach(async () => {
      treeDir = await mkdtemp(join(tmpdir(), "tree-test-"));
      // Create structure:
      // treeDir/
      //   src/
      //     index.ts
      //     utils/
      //       helper.ts
      //   node_modules/
      //     pkg/
      //       index.js
      //   .git/
      //     HEAD
      //   README.md
      await mkdir(join(treeDir, "src", "utils"), { recursive: true });
      await mkdir(join(treeDir, "node_modules", "pkg"), { recursive: true });
      await mkdir(join(treeDir, ".git"), { recursive: true });
      await writeFile(join(treeDir, "src", "index.ts"), "");
      await writeFile(join(treeDir, "src", "utils", "helper.ts"), "");
      await writeFile(join(treeDir, "node_modules", "pkg", "index.js"), "");
      await writeFile(join(treeDir, ".git", "HEAD"), "");
      await writeFile(join(treeDir, "README.md"), "");
    });

    afterEach(async () => {
      await rm(treeDir, { recursive: true, force: true });
    });

    it("generates tree string excluding .git by default", async () => {
      const tree = await listDirTree(treeDir);
      expect(tree).toContain("src/");
      expect(tree).toContain("node_modules/");
      expect(tree).toContain("README.md");
      expect(tree).not.toContain(".git");
    });

    it("excludes paths listed in excludedPaths", async () => {
      const tree = await listDirTree(treeDir, {
        excludedPaths: ["node_modules"],
      });
      expect(tree).toContain("src/");
      expect(tree).toContain("README.md");
      expect(tree).not.toContain("node_modules");
    });

    it("excludes multiple paths", async () => {
      const tree = await listDirTree(treeDir, {
        excludedPaths: ["node_modules", "src/utils"],
      });
      expect(tree).toContain("src/");
      expect(tree).toContain("index.ts");
      expect(tree).not.toContain("node_modules");
      expect(tree).not.toContain("utils");
      expect(tree).not.toContain("helper.ts");
    });

    it("respects maxDepth option", async () => {
      const tree = await listDirTree(treeDir, { maxDepth: 1 });
      expect(tree).toContain("src/");
      expect(tree).toContain("node_modules/");
      // depth 1 should not show contents of subdirs
      expect(tree).not.toContain("index.ts");
      expect(tree).not.toContain("helper.ts");
    });

    it("returns empty string for non-existent directory", async () => {
      const tree = await listDirTree("/nonexistent-abc-123");
      expect(tree).toBe("");
    });
  });
});
