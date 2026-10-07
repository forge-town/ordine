import { describe, expect, it, vi } from "vitest";
import { createGetCanvasRunCompletionMethod } from "./getCanvasRunCompletion.method";

describe("getCanvasRunCompletion", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createGetCanvasRunCompletionMethod({
        actionsDao: { findManyByRunId: vi.fn().mockResolvedValue([]) },
      } as never)("run-1"),
    ).toEqual({ hasCanvasMutations: false, complete: true, changeSetIds: [] });
  });
});
