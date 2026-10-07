import { describe, expect, it, vi } from "vitest";
import type { RefinementRound } from "@repo/schemas";
import { createUpdateRoundHelper } from "./updateRound.helper";
describe("updateRound", () => {
  it("changes only the selected round and preserves the input round list", async () => {
    const first: RefinementRound = {
      round: 1,
      pipelineId: null,
      jobId: null,
      distillationId: null,
      status: "pending",
      summary: "",
      error: null,
    };
    const second = { ...first, round: 2 };
    const rounds = [first, second];
    const update = vi.fn().mockResolvedValue(undefined);
    const result = await createUpdateRoundHelper({ update } as never)(
      "refinement-1",
      0,
      { status: "running", jobId: "job-1" },
      rounds,
    );
    expect(result[0]).toMatchObject({ round: 1, status: "running", jobId: "job-1" });
    expect(result[1]).toBe(second);
    expect(rounds[0]).toBe(first);
    expect(first.status).toBe("pending");
    expect(update).toHaveBeenCalledWith("refinement-1", { rounds: result });
  });
});
