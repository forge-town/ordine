import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanSkillFiles } from "./scanSkillFiles.helper";
describe("scanSkillFiles", () => {
  const context = { root: "" };
  beforeEach(async () => {
    context.root = await mkdtemp(join(tmpdir(), "ordine-skill-scan-"));
    await mkdir(join(context.root, "review"));
    await mkdir(join(context.root, ".hidden"));
    await writeFile(join(context.root, "review", "SKILL.md"), "# Review");
    await writeFile(join(context.root, ".hidden", "SKILL.md"), "# Hidden");
  });
  afterEach(async () => {
    await rm(context.root, { recursive: true, force: true });
  });
  it("discovers visible skill files while excluding hidden directories", async () => {
    const result = await scanSkillFiles({ rootPath: context.root });
    expect(result).toEqual({ paths: [join(context.root, "review", "SKILL.md")], errors: [] });
  });
  it("returns an actionable scan error for a missing root without rejecting", async () => {
    const rootPath = join(context.root, "missing");
    const result = await scanSkillFiles({ rootPath });
    expect(result.paths).toEqual([]);
    expect(result.errors[0]).toContain(rootPath);
  });
});
