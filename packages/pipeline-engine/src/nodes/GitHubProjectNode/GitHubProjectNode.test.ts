import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { processGitHubProjectNode } from "./GitHubProjectNode";
import type { PipelineEngineDeps } from "../../deps";
import type { PipelineNode } from "../../schemas";
import type { NodeContext } from "../types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

const testDir = join(tmpdir(), `gh-node-test-${Date.now()}`);

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
  await writeFile(join(testDir, "README.md"), "# Hello", "utf8");
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.mocked(trace).mockClear();
});

const makeDeps = (overrides: Partial<PipelineEngineDeps> = {}): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("")),
  runSkill: vi.fn().mockReturnValue(okAsync("")),
  runRuleCheck: vi.fn().mockResolvedValue({ stats: { totalFindings: 0, totalFiles: 0 } }),
  structuredJsonToMarkdown: vi.fn((c: string) => c),
  listDirTree: vi.fn().mockResolvedValue("README.md"),
  readProjectFiles: vi.fn().mockResolvedValue("# Hello"),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "gh-1",
  type: "github-project",
  position: { x: 0, y: 0 },
  data: { label: "gh-1", nodeType: "github-project", ...data } as PipelineNode["data"],
});

const makeCtx = (
  node: PipelineNode,
  deps: PipelineEngineDeps,
  githubToken?: string,
): NodeContext & { githubToken?: string } => ({
  node,
  input: { inputPath: "", content: "" },
  deps,
  nodeOutputs: new Map(),
  tempDirs: [],
  jobId: "job-1",
  githubToken,
});

describe("processGitHubProjectNode", () => {
  it("reads a local folder with tree disclosure", async () => {
    const deps = makeDeps();
    const node = makeNode({ sourceType: "local", localPath: testDir, disclosureMode: "tree" });
    const ctx = makeCtx(node, deps);

    const result = await processGitHubProjectNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("gh-1");
    expect(output).toBeDefined();
    expect(output!.inputPath).toBe(testDir);
    expect(output!.content).toContain("File tree:");
    expect(output!.content).toContain("README.md");
  });

  it("reads a local folder with full disclosure", async () => {
    const deps = makeDeps();
    const node = makeNode({ sourceType: "local", localPath: testDir, disclosureMode: "full" });
    const ctx = makeCtx(node, deps);

    const result = await processGitHubProjectNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("gh-1")!;
    expect(output.content).toContain("File tree:");
    expect(output.content).toContain("File contents:");
  });

  it("reads a local folder with files-only disclosure", async () => {
    const deps = makeDeps();
    const node = makeNode({
      sourceType: "local",
      localPath: testDir,
      disclosureMode: "files-only",
    });
    const ctx = makeCtx(node, deps);

    const result = await processGitHubProjectNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("gh-1")!;
    expect(output.content).toContain("File contents:");
    expect(output.content).not.toContain("File tree:");
  });

  it("handles missing localPath gracefully", async () => {
    const deps = makeDeps();
    const node = makeNode({ sourceType: "local" });
    const ctx = makeCtx(node, deps);

    const result = await processGitHubProjectNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("gh-1")!;
    expect(output.content).toBe("");
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("missing localPath"));
  });

  it("handles missing owner/repo gracefully", async () => {
    const deps = makeDeps();
    const node = makeNode({ sourceType: "remote" });
    const ctx = makeCtx(node, deps);

    const result = await processGitHubProjectNode(ctx);

    expect(result.ok).toBe(true);
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("missing owner/repo"));
  });

  it("passes excludedPaths to listDirTree", async () => {
    const deps = makeDeps();
    const node = makeNode({
      sourceType: "local",
      localPath: testDir,
      excludedPaths: [".git"],
    });
    const ctx = makeCtx(node, deps);

    await processGitHubProjectNode(ctx);

    expect(deps.listDirTree).toHaveBeenCalledWith(testDir, { excludedPaths: [".git"] });
  });

  it("always emits NODE_DONE on success", async () => {
    const deps = makeDeps();
    const node = makeNode({ sourceType: "local", localPath: testDir });
    const ctx = makeCtx(node, deps);

    await processGitHubProjectNode(ctx);

    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::gh-1");
  });
});
