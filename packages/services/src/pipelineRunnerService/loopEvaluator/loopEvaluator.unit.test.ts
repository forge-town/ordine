import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockRun = vi.hoisted(() => vi.fn());
vi.mock("@repo/agent-engine", () => ({
  agentEngine: { run: mockRun },
}));

import { loopEvaluator } from ".";

describe("loopEvaluator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when agent responds with PASS", async () => {
    mockRun.mockResolvedValue({ text: "PASS", usage: null });
    const factory = loopEvaluator.create({ apiKey: "job-api-key" });
    const evaluator = factory({ jobId: "job-1" });
    const result = await evaluator({
      conditionPrompt: "check quality",
      operationOutput: "some output",
      agent: "codex",
      model: "gpt-step",
    });

    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "codex",
        model: "gpt-step",
        apiKey: "job-api-key",
        mode: "direct",
        allowedTools: [],
      }),
    );
    expect(mockRun).not.toHaveBeenCalledWith(expect.objectContaining({ agent: "mastra" }));
  });

  it("returns false when agent responds with FAIL", async () => {
    mockRun.mockResolvedValue({ text: "FAIL", usage: null });
    const factory = loopEvaluator.create();
    const evaluator = factory({ jobId: "job-2" });
    const result = await evaluator({
      conditionPrompt: "check quality",
      operationOutput: "bad output",
      agent: "claude-code",
    });

    expect(result).toBe(false);
  });

  it("handles PASS with extra whitespace", async () => {
    mockRun.mockResolvedValue({ text: "  PASS  \n", usage: null });
    const factory = loopEvaluator.create();
    const evaluator = factory({ jobId: "job-3" });
    const result = await evaluator({
      conditionPrompt: "criteria",
      operationOutput: "output",
      agent: "codex",
    });

    expect(result).toBe(true);
  });

  it("fails clearly when no runtime route was resolved", async () => {
    const factory = loopEvaluator.create();
    const evaluator = factory({ jobId: "job-4" });

    await expect(
      evaluator({ conditionPrompt: "criteria", operationOutput: "output" }),
    ).rejects.toThrow("Loop evaluator runtime was not resolved");
    expect(mockRun).not.toHaveBeenCalled();
  });
});
