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
  const factory = loopEvaluator.create();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when agent responds with PASS", async () => {
    mockRun.mockResolvedValue({ text: "PASS", events: [] });
    const evaluator = factory({ jobId: "job-1" });
    const result = await evaluator("check quality", "some output");

    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "claude-code",
        mode: "direct",
        allowedTools: [],
      }),
    );
  });

  it("returns false when agent responds with FAIL", async () => {
    mockRun.mockResolvedValue({ text: "FAIL", events: [] });
    const evaluator = factory({ jobId: "job-2" });
    const result = await evaluator("check quality", "bad output");

    expect(result).toBe(false);
  });

  it("handles PASS with extra whitespace", async () => {
    mockRun.mockResolvedValue({ text: "  PASS  \n", events: [] });
    const evaluator = factory({ jobId: "job-3" });
    const result = await evaluator("criteria", "output");

    expect(result).toBe(true);
  });
});
