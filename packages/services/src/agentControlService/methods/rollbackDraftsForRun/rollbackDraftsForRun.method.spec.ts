import { describe, expect, it, vi } from "vitest";
import { createRollbackDraftsForRunMethod } from "./rollbackDraftsForRun.method";

describe("rollbackDraftsForRun", () => {
  it("retains the Agent Control contract boundary", async () => {
    const repository = { rejectChangeSet: vi.fn() };
    const rollback = createRollbackDraftsForRunMethod({
      actionsDao: {
        findManyByRunId: vi.fn().mockResolvedValue([{ runId: "other", changeSetId: "change-1" }]),
      },
      repository,
    } as never);
    expect(await rollback("run-1", "cancelled")).toEqual([]);
    expect(repository.rejectChangeSet).not.toHaveBeenCalled();
  });
});
