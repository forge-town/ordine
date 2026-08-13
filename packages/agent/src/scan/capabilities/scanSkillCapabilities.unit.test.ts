import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCapabilitySkillRoots, type CapabilitySkillRoot } from "./capabilitySkillRoots";
import { scanSkillCapabilities } from "./scanSkillCapabilities";

describe("capability skill discovery", () => {
  const tempDir = join(tmpdir(), `ordine-capability-skills-${randomUUID()}`);

  beforeEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("merges shared physical roots while preserving their runtime consumers", () => {
    const roots = getCapabilitySkillRoots({
      homeDir: "/home/tester",
      workspacePath: "/work/project",
      env: {},
    });
    const shared = roots.find(
      (root) => root.scope === "global" && root.path === join("/home/tester", ".agents", "skills"),
    );

    expect(shared?.consumers.map((consumer) => consumer.source)).toEqual([
      "codex",
      "cursor",
      "openclaw",
      "pi-agent",
      "opencode",
      "kimi-code",
    ]);
    expect(
      roots.flatMap((root) => root.consumers).some((consumer) => consumer.source === "mastra"),
    ).toBe(false);
  });

  it("scans a shared root once and assigns flat files only to runtimes that support them", async () => {
    const nestedDir = join(tempDir, "review-code");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(
      join(nestedDir, "SKILL.md"),
      "---\nname: review-code\ndescription: Review code carefully\n---\n\n# Workflow",
    );
    await writeFile(join(tempDir, "release.md"), "# Release safely");
    await writeFile(join(tempDir, "broken.md"), "---\nname: [\n---\nbody");
    const roots: CapabilitySkillRoot[] = [
      {
        path: tempDir,
        scope: "global",
        consumers: [
          { source: "opencode", supportsFlatFiles: true },
          { source: "pi-agent", supportsFlatFiles: false },
        ],
      },
    ];

    const result = await scanSkillCapabilities({ homeDir: tempDir, env: {}, roots });
    const nested = result.skills.find((skill) => skill.name === "review-code");
    const flat = result.skills.find((skill) => skill.name === "release");

    expect(nested?.sources.map((source) => source.source)).toEqual(["opencode", "pi-agent"]);
    expect(flat?.sources.map((source) => source.source)).toEqual(["opencode"]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ path: join(tempDir, "broken.md"), code: "malformed-skill" }),
    );
    expect(result.roots).toEqual([
      expect.objectContaining({ path: tempDir, status: "parsed", skillCount: 3 }),
    ]);
  });

  it("reports a missing root without turning it into a destructive empty-sync signal", async () => {
    const missingPath = join(tempDir, "missing");
    const result = await scanSkillCapabilities({
      homeDir: tempDir,
      env: {},
      roots: [
        {
          path: missingPath,
          scope: "global",
          consumers: [{ source: "claude-code", supportsFlatFiles: false }],
        },
      ],
    });

    expect(result.skills).toEqual([]);
    expect(result.roots).toEqual([
      expect.objectContaining({ path: missingPath, status: "missing", skillCount: 0 }),
    ]);
  });
});
