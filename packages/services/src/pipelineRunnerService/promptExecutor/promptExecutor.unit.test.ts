import { describe, expect, it, vi, beforeEach } from "vitest";
import { runClaude, runCodex, type SettingsResolver } from "@repo/agent";
import { recordAgentRunWithSpans } from "@repo/obs";

vi.mock("@repo/agent", () => ({
  runClaude: vi.fn().mockResolvedValue({ text: "claude-output" }),
  runCodex: vi.fn().mockResolvedValue("codex-output"),
  getModel: vi.fn().mockResolvedValue(null),
}));

vi.mock("@repo/obs", () => ({
  recordAgentRunWithSpans: vi.fn().mockResolvedValue(undefined),
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
    getSettings: vi.fn() as unknown as SettingsResolver,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to runClaude when agent is local-claude", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "local-claude" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("claude-output");
    expect(runClaude).toHaveBeenCalledOnce();
  });

  it("dispatches to runCodex when agent is codex", async () => {
    const result = await promptExecutor.run({ ...baseOpts, agent: "codex" });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe("codex-output");
    expect(runCodex).toHaveBeenCalledOnce();
    expect(runCodex).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "Analyze this",
        userPrompt: "some code",
        cwd: "/tmp/test",
      }),
    );
  });

  it("records an agent run for codex prompts when jobId is provided", async () => {
    const result = await promptExecutor.run({
      ...baseOpts,
      agent: "codex",
      jobId: "job-1",
    } as Parameters<typeof promptExecutor.run>[0] & { jobId: string });

    expect(result.isOk()).toBe(true);
    expect(recordAgentRunWithSpans).toHaveBeenCalledOnce();
    expect(recordAgentRunWithSpans).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        agentSystem: "codex",
        rawPayload: expect.objectContaining({
          system: "Analyze this",
          prompt: "some code",
          output: "codex-output",
        }),
        status: "completed",
      }),
      expect.any(Function),
    );
  });

  it("returns error for empty prompt", async () => {
    const result = await promptExecutor.run({ ...baseOpts, prompt: "  " });
    expect(result.isErr()).toBe(true);
  });
});
