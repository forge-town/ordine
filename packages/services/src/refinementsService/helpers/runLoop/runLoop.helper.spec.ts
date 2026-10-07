import { describe, expect, it, vi } from "vitest";
import type { RefinementRound } from "@repo/schemas";
vi.mock("@repo/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
import { createRunLoopHelper } from "./runLoop.helper";
describe("runLoop", () => {
  it("records an unsuccessful optimization round and continues to finalize the loop", async () => {
    const round: RefinementRound = {
      round: 1,
      pipelineId: null,
      jobId: null,
      distillationId: null,
      status: "pending",
      summary: "",
      error: null,
    };
    const update = vi.fn().mockResolvedValue(undefined);
    const updateRound = vi
      .fn()
      .mockImplementation(async (_id, _index, patch, rounds) => [{ ...rounds[0], ...patch }]);
    const optimizeFromDistillation = vi.fn().mockResolvedValue(undefined);
    const loop = createRunLoopHelper(
      { update } as never,
      {} as never,
      {} as never,
      {} as never,
      { optimizeFromDistillation } as never,
      {} as never,
      {} as never,
      updateRound,
    );
    await loop("refinement-1", "source-1", [round]);
    expect(updateRound).toHaveBeenCalledWith(
      "refinement-1",
      0,
      { status: "failed", error: "Pipeline optimization returned empty" },
      expect.any(Array),
    );
    await vi.waitFor(() => {
      expect(update).toHaveBeenCalledWith("refinement-1", { status: "completed" });
    });
  });
});
