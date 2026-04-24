import { describe, it, expect, vi, beforeEach } from "vitest";
import { okAsync, errAsync } from "neverthrow";
import { executeOperationNode, processOperationNode } from "./OperationNode";
import type { PipelineEngineDeps } from "../../deps";
import type { ExecutorConfig } from "@repo/schemas";
import type { PipelineNode, NodeCtx } from "../../schemas";
import type { OperationNodeContext, OperationInfo } from "../types";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
  initObs: vi.fn(),
}));

import { trace } from "@repo/obs";

beforeEach(() => {
  vi.mocked(trace).mockClear();
});

const makeDeps = (overrides: Partial<PipelineEngineDeps> = {}): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("prompt-output")),
  runSkill: vi.fn().mockReturnValue(okAsync("skill-output")),
  runRuleCheck: vi.fn().mockResolvedValue({
    stats: { totalFindings: 2, totalFiles: 3 },
  }),
  structuredJsonToMarkdown: vi.fn((c: string) => c),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const makeNode = (data: Record<string, unknown> = {}): PipelineNode => ({
  id: "op-1",
  type: "operation",
  position: { x: 0, y: 0 },
  data: { label: "op-1", nodeType: "operation", ...data } as PipelineNode["data"],
});

const makeInput = (content = "input text", inputPath = "/src"): NodeCtx => ({
  inputPath,
  content,
});

const makeOperation = (executor: ExecutorConfig): OperationInfo => ({
  id: "op-id",
  name: "Test Op",
  config: { executor },
});

const makeCtx = (
  deps: PipelineEngineDeps,
  operations: Map<string, OperationInfo>,
  overrides: Partial<OperationNodeContext> = {},
): OperationNodeContext => ({
  node: makeNode({ operationId: "op-id" }),
  input: makeInput(),
  deps,
  nodeOutputs: new Map(),
  tempDirs: [],
  operations,
  lookupSkill: vi.fn().mockResolvedValue(null),
  lookupBestPractice: vi.fn().mockResolvedValue(null),
  jobId: "job-1",
  ...overrides,
});

describe("executeOperationNode", () => {
  it("returns error when operation is not found", async () => {
    const deps = makeDeps();
    const node = makeNode({ operationId: "missing" });
    const ctx = makeCtx(deps, new Map());

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeNull();
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("not found"));
  });

  it("executes a prompt-type operation", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Do analysis" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toBe("prompt-output");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Do analysis" }));
  });

  it("executes a skill-type operation", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "skill", skillId: "sk-1" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.content).toBe("skill-output");
    expect(deps.runSkill).toHaveBeenCalledWith(expect.objectContaining({ skillId: "sk-1" }));
  });

  it("passes skill systemPrompt override to runSkill", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "skill",
      skillId: "sk-1",
      systemPrompt: "CUSTOM SKILL PROMPT",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "sk-1",
        systemPrompt: "CUSTOM SKILL PROMPT",
      }),
    );
  });

  it("executes a rule-check operation", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "rule-check" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const parsed = JSON.parse(result.content);
      expect(parsed.stats.totalFindings).toBe(2);
    }
    expect(deps.runRuleCheck).toHaveBeenCalledWith("/src");
  });

  it("fails when prompt text is empty", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "  " });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(false);
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("Prompt text is empty"));
  });

  it("fails when skill has no skillId", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "skill" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(false);
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("No skillId"));
  });

  it("fails when no executor is configured", async () => {
    const deps = makeDeps();
    const op: OperationInfo = { id: "op-id", name: "No Exec", config: {} };
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(false);
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("No executor configured"));
  });

  it("prepends best practice content when available", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Analyze" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", bestPracticeId: "bp-1" });
    const ctx = makeCtx(deps, ops, {
      lookupBestPractice: vi.fn().mockResolvedValue({
        title: "Clean Code",
        content: "Write tests first",
      }),
    });

    await executeOperationNode(node, makeInput(), ctx);

    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        inputContent: expect.stringContaining("Write tests first"),
      }),
    );
  });

  it("returns error when runPrompt fails", async () => {
    const deps = makeDeps({
      runPrompt: vi.fn().mockReturnValue(errAsync(new Error("LLM timeout"))),
    });
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error?.message).toContain("LLM timeout");
  });
});

describe("processOperationNode", () => {
  it("stores operation output in nodeOutputs", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops, { node });

    const result = await processOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    const output = ctx.nodeOutputs.get("op-1");
    expect(output).toBeDefined();
    expect(output!.content).toBe("prompt-output");
  });

  it("falls back to parent input when operation returns empty", async () => {
    const deps = makeDeps({
      runPrompt: vi.fn().mockReturnValue(okAsync("")),
    });
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops, { node });

    await processOperationNode(node, makeInput("parent content"), ctx);

    const output = ctx.nodeOutputs.get("op-1");
    expect(output!.content).toBe("parent content");
  });

  it("runs loops and stops when condition passes", async () => {
    const deps = makeDeps({
      evaluateLoopCondition: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    });
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Iterate" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({
      operationId: "op-id",
      loopEnabled: true,
      maxLoopCount: 5,
      loopConditionPrompt: "Is it done?",
    });
    const ctx = makeCtx(deps, ops, { node });

    const result = await processOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledTimes(2);
    expect(deps.evaluateLoopCondition).toHaveBeenCalledTimes(2);
    expect(trace).toHaveBeenCalledWith(
      "job-1",
      expect.stringContaining("Condition PASSED on iteration 2"),
    );
  });

  it("stops at maxLoopCount when condition never passes", async () => {
    const deps = makeDeps({
      evaluateLoopCondition: vi.fn().mockResolvedValue(false),
    });
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Iterate" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({
      operationId: "op-id",
      loopEnabled: true,
      maxLoopCount: 3,
      loopConditionPrompt: "Done?",
    });
    const ctx = makeCtx(deps, ops, { node });

    const result = await processOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledTimes(3);
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("Max iterations (3)"));
  });

  it("emits NODE_DONE on success", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops, { node });

    await processOperationNode(node, makeInput(), ctx);

    expect(trace).toHaveBeenCalledWith("job-1", "@@NODE_DONE::op-1");
  });
});

describe("executeOperationNode — agent override", () => {
  it("uses agentRuntime from node data as agent override for prompt mode", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "prompt",
      prompt: "Analyze",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentRuntime: "codex" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("uses agentRuntime from node data as agent override for skill mode", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "skill",
      skillId: "sk-1",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentRuntime: "claude-code" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runSkill).toHaveBeenCalledWith(expect.objectContaining({ agent: "claude-code" }));
  });

  it("falls back to executor.agent when agentRuntime is not set", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "prompt",
      prompt: "Analyze",
      agent: "codex",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });
});

describe("executeOperationNode — GitHub remote mode", () => {
  it("passes extraTools and githubToken when input has githubRemote", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Evaluate" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const input: NodeCtx = {
      inputPath: "https://github.com/forge-town/ordine",
      content: "GitHub Repository: forge-town/ordine",
      githubRemote: { owner: "forge-town", repo: "ordine", branch: "main" },
    };
    const ctx = makeCtx(deps, ops, { githubToken: "ghp_test123" });

    const result = await executeOperationNode(node, input, ctx);

    expect(result.ok).toBe(true);
    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extraTools: expect.arrayContaining(["Bash(gh:*)"]),
        githubToken: "ghp_test123",
      }),
    );
  });

  it("does not pass extraTools when input has no githubRemote", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Evaluate" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    await executeOperationNode(node, makeInput(), ctx);

    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        extraTools: undefined,
        githubToken: undefined,
      }),
    );
  });
});
