import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { processFolderNode } from "./FolderNode";
import type { PipelineEngineDeps } from "../deps";
import type { PipelineNode } from "../schemas";
import type { NodeContext } from "./types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

const testDir = join(tmpdir(), `folder-node-test-${Date.now()}`);

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
  await writeFile(join(testDir, "a.ts"), "const a = 1;", "utf8");
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
  listDirTree: vi.fn().mockResolvedValue("a.ts"),
  readProjectFiles: vi.fn().mockResolvedValue("// a.ts content"),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "folder-1",
  type: "folder",
  position: { x: 0, y: 0 },
  data: { label: "folder-1", nodeType: "folder", ...data } as PipelineNode["data"],
});

const makeCtx = (node: PipelineNode, deps: PipelineEngineDeps): NodeContext => ({
  node,
  input: { inputPath: "", content: "" },
  deps,
  nodeOutputs: new Map(),
  tempDirs: [],
  jobId: "job-1",
});

describe("processFolderNode", () => {
  it("produces tree-only content by default", async () => {
    const deps = makeDeps();
    const node = makeNode({ folderPath: testDir });
    const ctx = makeCtx(node, deps);

    const result = await processFolderNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("folder-1");
    expect(output).toBeDefined();
    expect(output!.inputPath).toBe(testDir);
    expect(output!.content).toContain("File tree:");
    expect(output!.content).toContain("a.ts");
    expect(output!.content).not.toContain("File contents:");
  });

  it("produces full content (tree + files) in 'full' mode", async () => {
    const deps = makeDeps();
    const node = makeNode({ folderPath: testDir, disclosureMode: "full" });
    const ctx = makeCtx(node, deps);

    const result = await processFolderNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("folder-1")!;
    expect(output.content).toContain("File tree:");
    expect(output.content).toContain("File contents:");
    expect(output.content).toContain("// a.ts content");
  });

  it("produces files-only content in 'files-only' mode", async () => {
    const deps = makeDeps();
    const node = makeNode({ folderPath: testDir, disclosureMode: "files-only" });
    const ctx = makeCtx(node, deps);

    const result = await processFolderNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("folder-1")!;
    expect(output.content).toContain("File contents:");
    expect(output.content).not.toContain("File tree:");
  });

  it("passes excludedPaths and includedExtensions to deps", async () => {
    const deps = makeDeps();
    const node = makeNode({
      folderPath: testDir,
      disclosureMode: "full",
      excludedPaths: ["node_modules"],
      includedExtensions: [".ts"],
    });
    const ctx = makeCtx(node, deps);

    await processFolderNode(ctx);

    expect(deps.listDirTree).toHaveBeenCalledWith(testDir, { excludedPaths: ["node_modules"] });
    expect(deps.readProjectFiles).toHaveBeenCalledWith(testDir, {
      excludedPaths: ["node_modules"],
      includedExtensions: [".ts"],
    });
  });

  it("stores empty content for a non-existent folder", async () => {
    const deps = makeDeps();
    const node = makeNode({ folderPath: "/nonexistent/folder" });
    const ctx = makeCtx(node, deps);

    const result = await processFolderNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("folder-1")!;
    expect(output.content).toBe("");
  });

  it("always emits NODE_DONE", async () => {
    const deps = makeDeps();
    const node = makeNode({ folderPath: testDir });
    const ctx = makeCtx(node, deps);

    await processFolderNode(ctx);

    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::folder-1");
  });
});
