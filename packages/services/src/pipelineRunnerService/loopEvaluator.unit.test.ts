import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@repo/obs", () => ({
  trace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { createLoopEvaluator } from "./loopEvaluator";

describe("loopEvaluator", () => {
  const mockGetModel = vi.fn();
  const factory = createLoopEvaluator(mockGetModel);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when no model is configured", async () => {
    mockGetModel.mockResolvedValue(null);
    const evaluator = factory("job-1");
    const result = await evaluator("check quality", "some output");

    expect(result).toBe(false);
  });
});
