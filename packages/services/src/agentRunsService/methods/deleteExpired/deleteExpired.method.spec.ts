import { describe, expect, it, vi } from "vitest";
import type { AgentRunsServiceBindings } from "../../contracts";
import { createDeleteExpiredMethod } from "./deleteExpired.method";

type RunsDao = AgentRunsServiceBindings["runsDao"];

const daoWithDeleteExpired = (deleteExpired: RunsDao["deleteExpired"]): RunsDao => ({
  create: vi.fn(),
  findById: vi.fn(),
  findManyUnfinished: vi.fn(),
  findManyRecoverable: vi.fn(),
  findLatestByOwner: vi.fn(),
  update: vi.fn(),
  transition: vi.fn(),
  claimExecutor: vi.fn(),
  refreshLease: vi.fn(),
  requestCancel: vi.fn(),
  deleteExpired,
});

describe("deleteExpired", () => {
  it.each([
    { records: [{ id: "run-1" }, { id: "run-2" }, { id: "run-3" }], count: 3 },
    { records: [], count: 0 },
  ])("returns $count for the expired records actually removed", async ({ records, count }) => {
    const deleteExpired = vi.fn<RunsDao["deleteExpired"]>().mockResolvedValue(records);
    const remove = createDeleteExpiredMethod({ runsDao: daoWithDeleteExpired(deleteExpired) });
    expect(await remove()).toBe(count);
  });

  it("preserves deletion rejection for the caller", async () => {
    const cause = new Error("deletion unavailable");
    const deleteExpired = vi.fn<RunsDao["deleteExpired"]>().mockRejectedValue(cause);
    const remove = createDeleteExpiredMethod({ runsDao: daoWithDeleteExpired(deleteExpired) });
    await expect(remove()).rejects.toBe(cause);
  });
});
