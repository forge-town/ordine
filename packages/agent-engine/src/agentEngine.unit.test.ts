import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ClaudeStreamEvent } from "@repo/agent";

const fakeClaudeEvents: ClaudeStreamEvent[] = [
  {
    type: "result",
    subtype: "success",
    duration_ms: 1000,
    total_cost_usd: 0.01,
    num_turns: 1,
  },
];

vi.mock("@repo/agent", () => ({
  runClaude: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");
    return { text: "fake claude output", events: fakeClaudeEvents };
  }),
  runCodex: vi.fn(async (opts: { onProgress?: (s: string) => Promise<void> }) => {
    await opts.onProgress?.("progress");
    return "fake codex output";
  }),
}));

vi.mock("@repo/obs", () => ({
  recordAgentRunWithSpans: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { agentEngine } from "./agentEngine";
import { recordAgentRunWithSpans } from "@repo/obs";

describe("agentEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to runClaude for claude-code", async () => {
    const result = await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "You are a linter",
      userPrompt: "Check this code",
      cwd: "/tmp/test",
      allowedTools: ["Read"],
    });

    expect(result.text).toBe("fake claude output");
    expect(result.events).toEqual(fakeClaudeEvents);
  });

  it("dispatches to runCodex for codex", async () => {
    const result = await agentEngine.run({
      agent: "codex",
      mode: "direct",
      systemPrompt: "Analyze this",
      userPrompt: "Hello",
      cwd: "/tmp/test",
    });

    expect(result.text).toBe("fake codex output");
    expect(result.events).toEqual([]);
  });

  it("throws for unsupported agent backend", async () => {
    await expect(
      agentEngine.run({
        agent: "unknown" as "claude-code",
        mode: "direct",
        systemPrompt: "x",
        userPrompt: "y",
        cwd: "/tmp",
      }),
    ).rejects.toThrow("Unsupported agent backend");
  });

  it("forwards onProgress to the underlying driver", async () => {
    const onProgress = vi.fn();

    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "x",
      userPrompt: "y",
      cwd: "/tmp",
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
  });

  it("records observability when jobId and agentId are provided", async () => {
    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "sys",
      userPrompt: "user",
      cwd: "/tmp",
      jobId: "job-1",
      agentId: "test-agent",
    });

    expect(recordAgentRunWithSpans).toHaveBeenCalledOnce();
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentSystem: "claude-code",
        agentId: "test-agent",
        rawPayload: expect.objectContaining({
          system: "sys",
          prompt: "user",
          output: "fake claude output",
        }),
        status: "completed",
      }),
      expect.any(Function),
    );
  });

  it("skips observability when jobId or agentId is missing", async () => {
    await agentEngine.run({
      agent: "claude-code",
      mode: "direct",
      systemPrompt: "x",
      userPrompt: "y",
      cwd: "/tmp",
    });

    expect(recordAgentRunWithSpans).not.toHaveBeenCalled();
  });
});
