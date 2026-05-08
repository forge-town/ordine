import { describe, it, expect, vi, beforeEach } from "vitest";
import { processPromptNode } from "./PromptNode";
import type { PipelineEngineDeps } from "../../deps";
import type { PipelineNode } from "../../schemas";
import type { NodeContext } from "../types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

beforeEach(() => {
  vi.mocked(trace).mockClear();
});

const makeDeps = (): PipelineEngineDeps => ({
  runPrompt: vi.fn(),
  runSkill: vi.fn(),
  structuredJsonToMarkdown: vi.fn((c: string) => c),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "prompt-1",
  type: "prompt",
  position: { x: 0, y: 0 },
  data: { label: "test prompt", nodeType: "prompt", prompt: "Hello world", ...data } as PipelineNode["data"],
});

const makeCtx = (node: PipelineNode): NodeContext => ({
  node,
  input: { inputPath: "", content: "" },
  deps: makeDeps(),
  nodeOutputs: new Map(),
  tempDirs: [],
  jobId: "job-1",
});

describe("processPromptNode", () => {
  it("sets node output to prompt text", async () => {
    const node = makeNode({ prompt: "Do something useful" });
    const ctx = makeCtx(node);

    const result = await processPromptNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("prompt-1");
    expect(output).toBeDefined();
    expect(output!.inputPath).toBe("");
    expect(output!.content).toBe("Do something useful");
  });

  it("handles empty prompt", async () => {
    const node = makeNode({ prompt: "" });
    const ctx = makeCtx(node);

    const result = await processPromptNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("prompt-1");
    expect(output).toBeDefined();
    expect(output!.content).toBe("");
  });

  it("handles missing prompt field as empty string", async () => {
    const node = makeNode({ prompt: undefined });
    const ctx = makeCtx(node);

    const result = await processPromptNode(ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("prompt-1");
    expect(output!.content).toBe("");
  });

  it("traces node completion", async () => {
    const node = makeNode({ prompt: "test" });
    const ctx = makeCtx(node);

    await processPromptNode(ctx);

    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("test prompt"));
    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::prompt-1");
  });

  it("returns failure for non-prompt nodeType", async () => {
    const node = makeNode();
    (node.data as Record<string, unknown>).nodeType = "folder";
    const ctx = makeCtx(node);

    const result = await processPromptNode(ctx);

    expect(result.ok).toBe(false);
    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_FAIL::prompt-1");
  });
});
