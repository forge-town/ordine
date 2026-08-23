import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { pipelineRunnerEngineDeps } from "./engineDeps";
import type { LoopEvaluatorFn } from "../loopEvaluator";

vi.mock("../promptExecutor", () => ({
  promptExecutor: {
    run: vi.fn(),
  },
}));

vi.mock("../skillExecutor", () => ({
  skillExecutor: {
    run: vi.fn(),
  },
}));

describe("pipelineRunnerEngineDeps", () => {
  const evaluateLoopCondition = vi.fn<LoopEvaluatorFn>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes jobId to promptExecutor", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
    });

    deps.runPrompt({
      prompt: "analyze",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "analyze",
        inputContent: "content",
        inputPath: "/tmp/project",
        jobId: "job-1",
      }),
    );
  });

  it("passes jobId to skillExecutor", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
    });

    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(skillExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "skill-1",
        skillDescription: "desc",
        inputContent: "content",
        inputPath: "/tmp/project",
        jobId: "job-1",
      }),
    );
  });

  it("passes the persistent Agent Run controller to prompt and skill executors", () => {
    const agentRunController = vi.fn();
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      agentRunController,
    });

    deps.runPrompt({ prompt: "analyze", inputContent: "content", inputPath: "/tmp/project" });
    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ agentRunController }),
    );
    expect(skillExecutor.run).toHaveBeenCalledWith(expect.objectContaining({ agentRunController }));
  });

  it("applies defaultAgent to runPrompt when agent is not specified", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      defaultAgent: "claude-code",
      model: "claude-default",
      ssh: { mode: "ssh", host: "example.com", user: "runner" },
    });

    deps.runPrompt({
      prompt: "analyze",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "claude-code",
        model: "claude-default",
        ssh: { mode: "ssh", host: "example.com", user: "runner" },
      }),
    );
  });

  it("preserves explicit agent over defaultAgent", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      defaultAgent: "claude-code",
      model: "claude-default",
      ssh: { mode: "ssh", host: "example.com", user: "runner" },
    });

    deps.runPrompt({
      prompt: "analyze",
      inputContent: "content",
      inputPath: "/tmp/project",
      agent: "codex",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
      }),
    );
    const call = vi.mocked(promptExecutor.run).mock.calls[0]?.[0] as {
      model?: unknown;
      ssh?: unknown;
    };
    expect(call.model).toBeUndefined();
    expect(call.ssh).toBeUndefined();
  });

  it("uses the run-level execution choice instead of a stale operation route", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      defaultAgent: "codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "xhigh",
      speed: "priority",
      runtimeConfigId: "local-codex",
      executablePath: "C:\\Tools\\codex.cmd",
      overrideOperationRoute: true,
    });

    deps.runPrompt({
      prompt: "analyze",
      inputContent: "content",
      inputPath: "C:\\workspace",
      agent: "codex",
      model: "gpt-5",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        model: "gpt-5.6-luna",
        reasoningEffort: "xhigh",
        speed: "priority",
        runtimeConfigId: "local-codex",
        executablePath: "C:\\Tools\\codex.cmd",
      }),
    );
  });

  it("resolves the same default runtime and model for loop evaluation", async () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      defaultAgent: "codex",
      model: "gpt-default",
      ssh: { mode: "ssh", host: "example.com", user: "runner" },
    });

    await deps.evaluateLoopCondition({
      conditionPrompt: "is it complete?",
      operationOutput: "candidate",
    });

    expect(evaluateLoopCondition).toHaveBeenCalledWith({
      conditionPrompt: "is it complete?",
      operationOutput: "candidate",
      agent: "codex",
      model: "gpt-default",
      ssh: { mode: "ssh", host: "example.com", user: "runner" },
    });
  });

  it("preserves an explicit step route for loop evaluation", async () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      defaultAgent: "claude-code",
      model: "claude-default",
      ssh: { mode: "ssh", host: "example.com", user: "runner" },
    });

    await deps.evaluateLoopCondition({
      conditionPrompt: "is it complete?",
      operationOutput: "candidate",
      agent: "codex",
      model: "gpt-step",
    });

    expect(evaluateLoopCondition).toHaveBeenCalledWith({
      conditionPrompt: "is it complete?",
      operationOutput: "candidate",
      agent: "codex",
      model: "gpt-step",
    });
  });

  it("applies defaultAgent to runSkill when agent is not specified", () => {
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      defaultAgent: "claude-code",
    });

    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(skillExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "claude-code",
      }),
    );
  });

  it("passes Claude MCP injection provider to prompt and skill executors", () => {
    const getMcpConnectorInjection = vi.fn().mockResolvedValue(null);
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      getMcpConnectorInjection,
    });

    deps.runPrompt({
      prompt: "publish",
      inputContent: "content",
      inputPath: "/tmp/project",
    });
    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ getMcpConnectorInjection }),
    );
    expect(skillExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ getMcpConnectorInjection }),
    );
  });

  it("forwards the shared run cancellation signal to prompt and skill executors", () => {
    const controller = new AbortController();
    const deps = pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId: "job-1",
      signal: controller.signal,
    });

    deps.runPrompt({ prompt: "publish", inputContent: "content", inputPath: "/tmp/project" });
    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(skillExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
