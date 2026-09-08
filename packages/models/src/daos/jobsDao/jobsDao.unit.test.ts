import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as DrizzleOrm from "drizzle-orm";
import { createJobsDao } from "./jobsDao";
import type { DbExecutor } from "../../types";

const mockReturning = vi.fn();
const mockLimit = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockOrderBy = vi.fn((): Promise<Record<string, unknown>[]> => Promise.resolve([]));
const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  limit: mockLimit,
  orderBy: mockOrderBy,
}));
const mockFrom = vi.fn(() => ({
  where: mockWhere,
  orderBy: mockOrderBy,
}));
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockSet = vi.fn(() => ({ where: mockWhere }));

const mockDb = {
  select: vi.fn(() => ({ from: mockFrom })),
  insert: vi.fn(() => ({ values: mockValues })),
  update: vi.fn(() => ({ set: mockSet })),
  delete: vi.fn(() => ({ where: mockWhere })),
};

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();

  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, type: "eq" })),
    desc: vi.fn((col) => ({ col, type: "desc" })),
    and: vi.fn((...args) => ({ type: "and", args })),
  };
});

const makeRow = (
  id: string,
  status: "queued" | "running" | "done" | "failed" | "cancelled" = "queued",
) => ({
  id,
  status,
  type: "pipeline_run" as const,
  title: "Job",
  parentJobId: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
});

const dao = createJobsDao(mockDb as unknown as DbExecutor);

describe("jobsDao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findMany returns entities without filter", async () => {
    const row = makeRow("job-1");
    mockOrderBy.mockResolvedValueOnce([row]);

    const result = await dao.findMany();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("job-1");
  });

  it("findById returns entity when found", async () => {
    const row = makeRow("job-2");
    mockLimit.mockResolvedValueOnce([row]);

    const result = await dao.findById("job-2");

    expect(result).not.toBeUndefined();
    expect(result?.id).toBe("job-2");
  });

  it("create inserts and returns entity", async () => {
    const row = makeRow("job-3");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.create({
      id: "job-3",
      status: "queued",
      type: "pipeline_run",
      title: "Job",
    });

    expect(result.id).toBe("job-3");
  });

  it("updateStatus returns updated entity", async () => {
    const row = makeRow("job-4", "running");
    mockReturning.mockResolvedValueOnce([row]);

    const result = await dao.updateStatus("job-4", "running", { startedAt: new Date() });

    expect(result).not.toBeUndefined();
    expect(result?.status).toBe("running");
  });

  it("persists token totals and per-node statuses", async () => {
    const row = makeRow("job-5", "done");
    mockReturning.mockResolvedValue([row]);

    await dao.updateStatus("job-5", "done", { totalTokens: 1200 });
    await dao.setNodeStatuses("job-5", { "node-1": "done" });

    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ status: "done", totalTokens: 1200 }),
    );
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ nodeStatuses: { "node-1": "done" } }),
    );
  });

  it("claims and renews an execution lease with caller-provided UTC instants", async () => {
    const claimedAt = new Date("2026-06-01T12:00:00.000Z");
    const firstExpiry = new Date("2026-06-01T12:01:30.000Z");
    const heartbeatAt = new Date("2026-06-01T12:00:30.000Z");
    const renewedExpiry = new Date("2026-06-01T12:02:00.000Z");
    mockReturning.mockResolvedValueOnce([makeRow("job-lease", "running")]);
    mockReturning.mockResolvedValueOnce([{ status: "running" }]);

    await dao.claimExecutionLease("job-lease", "worker-1", claimedAt, firstExpiry);
    await dao.renewExecutionLease("job-lease", "worker-1", heartbeatAt, renewedExpiry);

    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "running",
        startedAt: claimedAt,
        lastProgressAt: claimedAt,
        heartbeatAt: claimedAt,
        leaseOwnerId: "worker-1",
        leaseExpiresAt: firstExpiry,
      }),
    );
    expect(mockSet).toHaveBeenNthCalledWith(2, {
      heartbeatAt,
      leaseExpiresAt: renewedExpiry,
      updatedAt: heartbeatAt,
    });
  });

  it("clears a lease whenever a Job reaches a terminal status", async () => {
    mockReturning.mockResolvedValueOnce([makeRow("job-terminal", "done")]);

    await dao.transitionStatus("job-terminal", ["running", "paused"], "done", {
      finishedAt: new Date("2026-06-01T12:00:00.000Z"),
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "done", leaseOwnerId: null, leaseExpiresAt: null }),
    );
  });

  it("uses one observed instant and records structured reasons during a stale sweep", async () => {
    const observedAt = new Date("2026-06-01T12:00:00.000Z");
    mockReturning
      .mockResolvedValueOnce([
        {
          id: "queued-stale",
          expiryContext: { reason: "queue_timeout" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "running-stale",
          expiryContext: { reason: "lease_expired" },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const expired = await dao.expireStaleJobs({
      observedAt,
      queuedTimeoutMs: 60_000,
      legacyNoLeaseTimeoutMs: 120_000,
      sweeperId: "sweeper-1",
    });

    expect(expired.map(({ id }) => id)).toEqual(["queued-stale", "running-stale"]);
    expect(mockSet).toHaveBeenCalledTimes(5);
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        status: "expired",
        finishedAt: observedAt,
        updatedAt: observedAt,
        expiryContext: {
          reason: "queue_timeout",
          previousStatus: "queued",
          observedAtMs: observedAt.getTime(),
          staleBeforeMs: observedAt.getTime() - 60_000,
          timeoutMs: 60_000,
          sweeperId: "sweeper-1",
        },
      }),
    );
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        expiryContext: expect.objectContaining({
          reason: "lease_expired",
          previousStatus: "running",
          observedAtMs: observedAt.getTime(),
          staleBeforeMs: observedAt.getTime(),
          timeoutMs: null,
        }),
      }),
    );
    const statusPatches = mockSet.mock.calls as unknown as Array<[Record<string, unknown>]>;
    for (const [patch] of statusPatches) {
      expect(patch).not.toHaveProperty("error");
    }
  });

  it("delete calls db.delete", async () => {
    await dao.delete("job-6");
    expect(mockWhere).toHaveBeenCalled();
  });
});
