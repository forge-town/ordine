import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { okAsync, errAsync } from "neverthrow";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeOperationNode, processOperationNode } from "./OperationNode";
import type { PipelineEngineDeps } from "../../deps";
import type { OperationExecutorConfig, PipelineNode } from "@repo/schemas";
import type { NodeCtx } from "../../schemas";
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
  publishArtifact: vi.fn().mockReturnValue(okAsync("published")),
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

const makeOperation = (executor: OperationExecutorConfig): OperationInfo => ({
  id: "op-id",
  name: "Test Op",
  description: "Test operation description",
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
  lookupAgent: vi.fn().mockResolvedValue(null),
  lookupSkill: vi.fn().mockResolvedValue(null),
  jobId: "job-1",
  ...overrides,
});

describe("executeOperationNode", () => {
  it("returns error when operation is not found", async () => {
    const deps = makeDeps();
    const node = makeNode({ operationId: "missing" });
    const ctx = makeCtx(deps, new Map());

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") expect(result.error.message).toContain("missing");
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("not found"));
  });

  it("executes a prompt-type operation", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Do analysis" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    if (result.outcome === "completed") expect(result.content).toBe("prompt-output");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ prompt: "Do analysis" }));
  });

  it("passes structured pipeline and operation runtime context to prompt operations", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Do analysis" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops, {
      pipelineContext: {
        name: "Quality Pipeline",
        description: "Review a project end to end",
        sharedContext: "Review a project end to end",
      },
    });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: {
          pipeline: {
            name: "Quality Pipeline",
            description: "Review a project end to end",
            sharedContext: "Review a project end to end",
          },
          operation: {
            name: "Test Op",
            description: "Test operation description",
            instruction: "Do analysis",
          },
        },
      }),
    );
  });

  it("keeps standalone operation runtime context free of pipeline context", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Do analysis" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(deps.runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: {
          operation: {
            name: "Test Op",
            description: "Test operation description",
            instruction: "Do analysis",
          },
        },
      }),
    );
    const callArgs = (deps.runPrompt as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(callArgs.runtimeContext.pipeline).toBeUndefined();
  });

  it("executes a skill-type operation", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "skill", skillId: "sk-1" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    if (result.outcome === "completed") expect(result.content).toBe("skill-output");
    expect(deps.runSkill).toHaveBeenCalledWith(expect.objectContaining({ skillId: "sk-1" }));
  });

  it("passes structured runtime context to skill operations", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "skill", skillId: "sk-1" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const lookupSkill = vi
      .fn()
      .mockResolvedValue({ id: "sk-1", label: "Review Skill", description: "Review files" });
    const ctx = makeCtx(deps, ops, {
      lookupSkill,
      pipelineContext: {
        name: "Review Pipeline",
        description: "Review and summarize a repository",
        sharedContext: "Review and summarize a repository",
      },
    });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(deps.runSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        runtimeContext: {
          pipeline: {
            name: "Review Pipeline",
            description: "Review and summarize a repository",
            sharedContext: "Review and summarize a repository",
          },
          operation: {
            name: "Test Op",
            description: "Test operation description",
            instruction: "Review Skill: Review files",
          },
        },
      }),
    );
  });

  it("executes a publish-type operation via deps.publishArtifact", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "publish",
      publish: {
        target: "git",
        repo: "forge-town/ui-kit",
        branch: "main",
        openPr: true,
        subPath: "components",
        commitMessage: "publish",
      },
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops, { outputDir: "/out/showcase", githubToken: "tok" });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    if (result.outcome === "completed") expect(result.content).toBe("published");
    expect(deps.publishArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceDir: "/out/showcase",
        target: "git",
        repo: "forge-town/ui-kit",
        branch: "main",
        subPath: "components",
        githubToken: "tok",
      }),
    );
  });

  it("fails a publish operation missing its publish config (no publish call)", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "publish" });
    const ops = new Map([["op-id", op]]);
    const ctx = makeCtx(deps, ops, { outputDir: "/out" });

    const result = await executeOperationNode(makeNode({ operationId: "op-id" }), makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    expect(deps.publishArtifact).not.toHaveBeenCalled();
  });

  it("fails a publish operation with no resolved outputDir", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "publish",
      publish: { target: "localDir", outputDir: "/tmp/dest" },
    });
    const ops = new Map([["op-id", op]]);
    const ctx = makeCtx(deps, ops, { outputDir: undefined });

    const result = await executeOperationNode(makeNode({ operationId: "op-id" }), makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    expect(deps.publishArtifact).not.toHaveBeenCalled();
  });

  it("fails a publish operation when the runtime provides no publishArtifact dependency", async () => {
    const deps = makeDeps({ publishArtifact: undefined });
    const op = makeOperation({
      type: "publish",
      publish: { target: "git", repo: "forge-town/ui-kit", branch: "main", openPr: true },
    });
    const ops = new Map([["op-id", op]]);
    const ctx = makeCtx(deps, ops, { outputDir: "/out" });

    const result = await executeOperationNode(makeNode({ operationId: "op-id" }), makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error.message).toContain("missing publishArtifact dependency");
    }
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

    expect(result.outcome).toBe("completed");
    expect(deps.runSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "sk-1",
        systemPrompt: "CUSTOM SKILL PROMPT",
      }),
    );
  });

  it("fails when prompt text is empty", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "  " });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("soft-failed");
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("Prompt text is empty"));
  });

  it("fails when skill has no skillId", async () => {
    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "skill" });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("soft-failed");
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("No skillId"));
  });

  it("fails when no executor is configured", async () => {
    const deps = makeDeps();
    const op: OperationInfo = { id: "op-id", name: "No Exec", description: "", config: {} };
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("soft-failed");
    expect(trace).toHaveBeenCalledWith("job-1", expect.stringContaining("No executor configured"));
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

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") expect(result.error.message).toContain("LLM timeout");
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

    expect(result.outcome).toBe("completed");
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

    expect(result.outcome).toBe("completed");
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

    expect(result.outcome).toBe("completed");
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

    expect(result.outcome).toBe("completed");
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

    expect(result.outcome).toBe("completed");
    expect(deps.runSkill).toHaveBeenCalledWith(expect.objectContaining({ agent: "claude-code" }));
  });

  it("blocks Hermes for skill operations because local tool permissions cannot be preserved", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "skill",
      skillId: "sk-1",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentRuntime: "hermes" });
    const ctx = makeCtx(deps, ops);

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed")
      expect(result.error.message).toContain("Hermes is not available");
    expect(deps.runSkill).not.toHaveBeenCalled();
    expect(trace).toHaveBeenCalledWith(
      "job-1",
      expect.stringContaining("Hermes is not available for skill operation"),
    );
  });

  it("propagates Hermes skill failures instead of marking the node done", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "skill",
      skillId: "sk-1",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentRuntime: "hermes" });
    const ctx = makeCtx(deps, ops, { node });

    const result = await processOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("failed");
    if (result.outcome === "failed") {
      expect(result.error.message).toContain("Hermes is not available");
    }
    expect(ctx.nodeOutputs.has("op-1")).toBe(false);
    expect(trace).not.toHaveBeenCalledWith("job-1", "@@NODE_DONE::op-1");
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

    expect(result.outcome).toBe("completed");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("resolves agentId to agent runtime for prompt mode", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "prompt",
      prompt: "Analyze",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentId: "agent-1" });
    const lookupAgent = vi.fn().mockResolvedValue({
      id: "agent-1",
      name: "My Codex Agent",
      defaultRuntime: "codex",
    });
    const ctx = makeCtx(deps, ops, { lookupAgent });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(lookupAgent).toHaveBeenCalledWith("agent-1");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("resolves agentId to agent runtime for skill mode", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "skill",
      skillId: "sk-1",
      agent: "claude-code",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentId: "agent-2" });
    const lookupAgent = vi.fn().mockResolvedValue({
      id: "agent-2",
      name: "My Claude Agent",
      defaultRuntime: "claude-code",
    });
    const ctx = makeCtx(deps, ops, { lookupAgent });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(lookupAgent).toHaveBeenCalledWith("agent-2");
    expect(deps.runSkill).toHaveBeenCalledWith(expect.objectContaining({ agent: "claude-code" }));
  });

  it("agentId takes priority over agentRuntime", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "prompt",
      prompt: "Analyze",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({ operationId: "op-id", agentId: "agent-1", agentRuntime: "mastra" });
    const lookupAgent = vi.fn().mockResolvedValue({
      id: "agent-1",
      name: "Codex Agent",
      defaultRuntime: "codex",
    });
    const ctx = makeCtx(deps, ops, { lookupAgent });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "codex" }));
  });

  it("falls back to agentRuntime when agentId lookup returns null", async () => {
    const deps = makeDeps();
    const op = makeOperation({
      type: "agent",
      agentMode: "prompt",
      prompt: "Analyze",
    });
    const ops = new Map([["op-id", op]]);
    const node = makeNode({
      operationId: "op-id",
      agentId: "missing-agent",
      agentRuntime: "mastra",
    });
    const lookupAgent = vi.fn().mockResolvedValue(null);
    const ctx = makeCtx(deps, ops, { lookupAgent });

    const result = await executeOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(deps.runPrompt).toHaveBeenCalledWith(expect.objectContaining({ agent: "mastra" }));
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

    expect(result.outcome).toBe("completed");
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

describe("processOperationNode · dir-artifact capture", () => {
  const dirs = { out: "" };

  beforeEach(async () => {
    dirs.out = await mkdtemp(join(tmpdir(), "op-out-"));
    vi.mocked(trace).mockClear();
  });

  afterEach(async () => {
    await rm(dirs.out, { recursive: true, force: true });
  });

  const emittedArtifact = (): boolean =>
    vi
      .mocked(trace)
      .mock.calls.some((c) => typeof c[1] === "string" && c[1].startsWith("@@NODE_ARTIFACT::op-1"));

  it("emits a dir artifact for files the agent writes during the run", async () => {
    const deps = makeDeps({
      runPrompt: vi.fn().mockImplementation(() => {
        writeFileSync(join(dirs.out, "fresh.html"), "<h1>x</h1>");

        return okAsync("text answer");
      }),
    });
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, new Map([["op-id", op]]), { node, outputDir: dirs.out });

    const result = await processOperationNode(node, makeInput(), ctx);

    expect(result.outcome).toBe("completed");
    expect(emittedArtifact()).toBe(true);
  });

  it("does NOT attribute pre-existing stale files in a shared outputDir", async () => {
    await writeFile(join(dirs.out, "stale.html"), "old");
    const longAgo = new Date(Date.now() - 60_000);
    await utimes(join(dirs.out, "stale.html"), longAgo, longAgo);

    const deps = makeDeps(); // runPrompt writes nothing
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "Go" });
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, new Map([["op-id", op]]), { node, outputDir: dirs.out });

    await processOperationNode(node, makeInput(), ctx);

    expect(emittedArtifact()).toBe(false);
  });

  it("does NOT emit an artifact on a soft-skip (empty prompt) even with a fresh file present", async () => {
    // A future-mtime file would pass the mtime filter, but the soft-skip (exec.succeeded=false) must block capture
    await writeFile(join(dirs.out, "future.html"), "x");
    const future = new Date(Date.now() + 60_000);
    await utimes(join(dirs.out, "future.html"), future, future);

    const deps = makeDeps();
    const op = makeOperation({ type: "agent", agentMode: "prompt", prompt: "   " }); // empty → soft-skip
    const node = makeNode({ operationId: "op-id" });
    const ctx = makeCtx(deps, new Map([["op-id", op]]), { node, outputDir: dirs.out });

    await processOperationNode(node, makeInput(), ctx);

    expect(emittedArtifact()).toBe(false);
  });
});
