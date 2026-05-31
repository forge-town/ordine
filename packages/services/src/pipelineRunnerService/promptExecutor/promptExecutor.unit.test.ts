import { describe, expect, it, vi, beforeEach } from "vitest";
import { agentEngine } from "@repo/agent-engine";

vi.mock("@repo/agent", () => ({}));

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({ text: "claude-output", events: [] }),
  },
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

import { promptExecutor } from ".";

describe("promptExecutor", () => {
  const baseOpts = {
    prompt: "Analyze this",
    inputContent: "some code",
    inputPath: "/tmp/test",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agentEngine.run).mockResolvedValue({ text: "claude-output", events: [] });
  });

  it("dispatches to agentEngine when agent is claude-code", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "claude-code" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("claude-output");
    expect(agentEngine.run).toHaveBeenCalledOnce();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({ agent: "claude-code", mode: "direct" }),
    );
  });

  it("dispatches to agentEngine when agent is codex", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", events: [] });
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("codex-output");
    expect(agentEngine.run).toHaveBeenCalledOnce();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        mode: "direct",
        systemPrompt: "Analyze this",
        userPrompt: "some code",
        cwd: "/tmp/test",
      }),
    );
  });

  it("forwards jobId and agentId to agentEngine", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", events: [] });

    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      jobId: "job-1",
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentId: "prompt-executor",
      }),
    );
  });

  it("injects structured runtime context into the system prompt", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      runtimeContext: {
        pipeline: {
          name: "Repository Review",
          description: "Review the whole repository",
          purpose: "Review the whole repository",
        },
        operation: {
          name: "Summarize Findings",
          description: "Summarize all prior checks",
          instruction: "Analyze this",
        },
      },
    });

    expect(result.isOk()).toBe(true);
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining("## Runtime Context"),
      }),
    );
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toContain("### Pipeline-global context");
    expect(callArgs.systemPrompt).toContain("Pipeline name: Repository Review");
    expect(callArgs.systemPrompt).toContain("### Operation-local context");
    expect(callArgs.systemPrompt).toContain("Operation name: Summarize Findings");
    expect(callArgs.systemPrompt).toContain("## Operation Prompt");
    expect(callArgs.systemPrompt).toContain("Analyze this");
  });

  it("leaves standalone operation prompt unchanged without runtime context", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });

    expect(result.isOk()).toBe(true);
    const callArgs = vi.mocked(agentEngine.run).mock.calls[0]![0];
    expect(callArgs.systemPrompt).toBe("Analyze this");
  });

  it("returns error for empty prompt", async () => {
    const result = await promptExecutor.run({ ...baseOpts, prompt: "  " });
    expect(result.isErr()).toBe(true);
  });
});
