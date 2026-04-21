import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { processOutputLocalPathNode } from "./OutputLocalPathNode";
import type { PipelineEngineDeps } from "../deps";
import type { PipelineNode } from "../schemas";
import type { NodeContext } from "./types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

const testDir = join(tmpdir(), `output-node-test-${Date.now()}`);

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
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
  structuredJsonToMarkdown: vi.fn((c: string) => `# MD\n${c}`),
  listDirTree: vi.fn().mockResolvedValue(""),
  readProjectFiles: vi.fn().mockResolvedValue(""),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "out-1",
  type: "output-local-path",
  position: { x: 0, y: 0 },
  data: { label: "out-1", nodeType: "output-local-path", ...data } as PipelineNode["data"],
});

const makeCtx = (
  node: PipelineNode,
  deps: PipelineEngineDeps,
  inputContent = "test content",
): NodeContext => ({
  node,
  input: { inputPath: "/some/path", content: inputContent },
  deps,
  nodeOutputs: new Map(),
  tempDirs: [],
  jobId: "abcdef12-3456-7890",
});

describe("processOutputLocalPathNode", () => {
  it("writes content to a file in the results subdirectory", async () => {
    const outputDir = join(testDir, "write-test");
    const deps = makeDeps();
    const node = makeNode({ localPath: outputDir, outputFileName: "report.md" });
    const ctx = makeCtx(node, deps);

    const result = await processOutputLocalPathNode(ctx);

    expect(result.ok).toBe(true);
    const resultsDir = join(outputDir, "results");
    expect(existsSync(resultsDir)).toBe(true);
    expect(trace).toHaveBeenCalledWith(
      "abcdef12-3456-7890",
      expect.stringContaining("Wrote output to:"),
    );
    expect(trace).toHaveBeenCalledWith("abcdef12-3456-7890", "@@NODE_DONE::out-1");
  });

  it("stores input in nodeOutputs", async () => {
    const outputDir = join(testDir, "store-test");
    const deps = makeDeps();
    const node = makeNode({ localPath: outputDir });
    const ctx = makeCtx(node, deps);

    await processOutputLocalPathNode(ctx);

    const output = ctx.nodeOutputs.get("out-1");
    expect(output).toBeDefined();
    expect(output!.content).toBe("test content");
    expect(output!.inputPath).toBe("/some/path");
  });

  it("uses structuredJsonToMarkdown for .md output", async () => {
    const outputDir = join(testDir, "md-test");
    const deps = makeDeps();
    const node = makeNode({ localPath: outputDir, outputFileName: "out.md" });
    const ctx = makeCtx(node, deps, '{"key":"val"}');

    await processOutputLocalPathNode(ctx);

    expect(deps.structuredJsonToMarkdown).toHaveBeenCalledWith('{"key":"val"}');
  });

  it("writes dual output (json + md) when dualOutput is true", async () => {
    const outputDir = join(testDir, "dual-test");
    const deps = makeDeps();
    const node = makeNode({
      localPath: outputDir,
      outputFileName: "dual.json",
      dualOutput: true,
    });
    const ctx = makeCtx(node, deps, '{"result": true}');

    const result = await processOutputLocalPathNode(ctx);

    expect(result.ok).toBe(true);
    expect(trace).toHaveBeenCalledWith(
      "abcdef12-3456-7890",
      expect.stringContaining("Wrote JSON output"),
    );
    expect(trace).toHaveBeenCalledWith(
      "abcdef12-3456-7890",
      expect.stringContaining("Wrote Markdown output"),
    );
  });

  it("does not write when content is empty", async () => {
    const outputDir = join(testDir, "empty-test");
    const deps = makeDeps();
    const node = makeNode({ localPath: outputDir });
    const ctx = makeCtx(node, deps, "");

    const result = await processOutputLocalPathNode(ctx);

    expect(result.ok).toBe(true);
    expect(trace).not.toHaveBeenCalledWith(
      "abcdef12-3456-7890",
      expect.stringContaining("Wrote output"),
    );
  });

  it("defaults outputFileName to output.md", async () => {
    const outputDir = join(testDir, "default-name-test");
    const deps = makeDeps();
    const node = makeNode({ localPath: outputDir });
    const ctx = makeCtx(node, deps);

    await processOutputLocalPathNode(ctx);

    expect(trace).toHaveBeenCalledWith(
      "abcdef12-3456-7890",
      expect.stringContaining("output_abcdef12_"),
    );
  });

  it("always emits NODE_DONE", async () => {
    const deps = makeDeps();
    const node = makeNode({ localPath: join(testDir, "done-test") });
    const ctx = makeCtx(node, deps);

    await processOutputLocalPathNode(ctx);

    expect(trace).toHaveBeenCalledWith("abcdef12-3456-7890", "@@NODE_DONE::out-1");
  });
});
