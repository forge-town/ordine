import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readProjectFiles } from "../../filesystem.service";

describe("readProjectFiles", () => {
  const context = { root: "" };
  beforeEach(async () => {
    context.root = await mkdtemp(join(tmpdir(), "ordine-read-files-"));
    await mkdir(join(context.root, "node_modules"));
    await writeFile(join(context.root, "README.md"), "project brief");
    await writeFile(join(context.root, "index.ts"), "export const enabled = true;");
    await writeFile(
      join(context.root, "node_modules", "dependency.ts"),
      "private dependency content",
    );
    await writeFile(join(context.root, "image.png"), "binary placeholder");
  });
  afterEach(async () => {
    await rm(context.root, { recursive: true, force: true });
  });
  it("returns source content and relative filenames while excluding dependencies and binary files", async () => {
    const result = await readProjectFiles(context.root);
    expect(result).toContain("--- README.md ---\nproject brief");
    expect(result).toContain("--- index.ts ---\nexport const enabled = true;");
    expect(result).not.toContain("private dependency content");
    expect(result).not.toContain("binary placeholder");
  });
  it("respects explicit content exclusions and extension selection", async () => {
    const result = await readProjectFiles(context.root, {
      excludedPaths: ["README.md"],
      includedExtensions: [".md"],
    });
    expect(result).toBe("");
  });
  it("returns empty content for a missing project path", async () => {
    const result = await readProjectFiles(join(context.root, "missing"));
    expect(result).toBe("");
  });
});
