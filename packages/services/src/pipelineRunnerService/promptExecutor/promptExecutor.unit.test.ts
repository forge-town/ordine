import { describe, expect, it, vi, beforeEach } from "vitest";
import { agentEngine } from "@repo/agent-engine";

vi.mock("@repo/agent", () => ({}));

vi.mock("@repo/agent-engine", () => ({
  agentEngine: {
    run: vi.fn().mockResolvedValue({ text: "claude-output", usage: null }),
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
    vi.mocked(agentEngine.run).mockResolvedValue({ text: "claude-output", usage: null });
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
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", usage: null });
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("codex-output");
    expect(agentEngine.run).toHaveBeenCalledOnce();
    expect(agentEngine.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        mode: "direct",
        systemPrompt: expect.stringContaining("Analyze this"),
        userPrompt: "some code",
        // /tmp/test 不存在 → resolveCwd 回退到 process.cwd()
        cwd: process.cwd(),
      }),
    );
  });

  it("forwards jobId and agentId to agentEngine", async () => {
    vi.mocked(agentEngine.run).mockResolvedValueOnce({ text: "codex-output", usage: null });

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

  it("returns error for empty prompt", async () => {
    const result = await promptExecutor.run({ ...baseOpts, prompt: "  " });
    expect(result.isErr()).toBe(true);
  });

  it("injects pipeline-global and operation-local context into the system prompt (COD-40)", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "claude-code",
      runtimeContext: {
        pipeline: { name: "Release Notes", description: "ship notes", sharedContext: "keep tone" },
        operation: { name: "Draft", description: "write draft", instruction: "Analyze this" },
      },
    });

    expect(result.isOk()).toBe(true);
    const sys = vi.mocked(agentEngine.run).mock.calls[0]![0].systemPrompt as string;
    expect(sys).toContain("## Runtime Context");
    expect(sys).toContain("### Pipeline-global context");
    expect(sys).toContain("Pipeline name: Release Notes");
    expect(sys).toContain("Pipeline shared context: keep tone");
    expect(sys).toContain("### Operation-local context");
    expect(sys).toContain("Operation name: Draft");
    expect(sys).toContain("## Execution Priority");
    expect(sys).toContain("## Operation Prompt");
  });

  it("omits the runtime context section when no runtimeContext is provided", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "claude-code" });

    expect(result.isOk()).toBe(true);
    const sys = vi.mocked(agentEngine.run).mock.calls[0]![0].systemPrompt as string;
    expect(sys).not.toContain("## Runtime Context");
    expect(sys).toContain("Analyze this");
  });
});
