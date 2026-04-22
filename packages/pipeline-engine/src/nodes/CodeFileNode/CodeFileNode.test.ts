import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { okAsync } from "neverthrow";
import { processCodeFileNode } from "./CodeFileNode";
import type { PipelineEngineDeps } from "../../deps";
import type { PipelineNode } from "../../schemas";
import type { NodeContext } from "../types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

const testDir = join(tmpdir(), `code-file-node-test-${Date.now()}`);
const testFile = join(testDir, "hello.ts");

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
  await writeFile(testFile, 'console.log("hello");', "utf8");
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.mocked(trace).mockClear();
});

const makeDeps = (): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("")),
  runSkill: vi.fn().mockReturnValue(okAsync("")),
  runRuleCheck: vi.fn().mockResolvedValue({ stats: { totalFindings: 0, totalFiles: 0 } }),
  structuredJsonToMarkdown: vi.fn((c: string) => c),
  listDirTree: vi.fn().mockResolvedValue(""),
  readProjectFiles: vi.fn().mockResolvedValue(""),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "code-1",
  type: "code-file",
  position: { x: 0, y: 0 },
  data: { label: "code-1", nodeType: "code-file", ...data } as PipelineNode["data"],
});

const makeCtx = (node: PipelineNode, deps: PipelineEngineDeps): NodeContext => ({
  node,
  input: { inputPath: "", content: "" },
  deps,
  nodeOutputs: new Map(),
  tempDirs: [],
  jobId: "job-1",
});

describe("processCodeFileNode", () => {
  it("reads an existing file and stores content in nodeOutputs", async () => {
    const deps = makeDeps();
    const node = makeNode({ filePath: testFile });
    const ctx = makeCtx(node, deps);

    const result = await processCodeFileNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("code-1");
    expect(output).toBeDefined();
    expect(output!.inputPath).toBe(testFile);
    expect(output!.content).toBe('console.log("hello");');
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("Read code file"));
    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::code-1");
  });

  it("stores empty content for a non-existent file", async () => {
    const deps = makeDeps();
    const node = makeNode({ filePath: "/nonexistent/file.ts" });
    const ctx = makeCtx(node, deps);

    const result = await processCodeFileNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("code-1");
    expect(output).toBeDefined();
    expect(output!.content).toBe("");
    expect(output!.inputPath).toBe("/nonexistent/file.ts");
  });

  it("stores empty content when filePath is missing", async () => {
    const deps = makeDeps();
    const node = makeNode({});
    const ctx = makeCtx(node, deps);

    const result = await processCodeFileNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("code-1");
    expect(output!.content).toBe("");
    expect(output!.inputPath).toBe("");
  });

  it("always emits NODE_DONE", async () => {
    const deps = makeDeps();
    const node = makeNode({ filePath: testFile });
    const ctx = makeCtx(node, deps);

    await processCodeFileNode(ctx);

    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::code-1");
  });
});
