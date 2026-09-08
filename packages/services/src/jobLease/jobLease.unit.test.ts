import { afterEach, describe, expect, it, vi } from "vitest";
import type { JobsDao } from "@repo/models";
import { createJobLeaseController } from "./jobLease";

const makeJobsDao = () =>
  ({
    claimExecutionLease: vi.fn(),
    renewExecutionLease: vi.fn(),
  }) as unknown as JobsDao;

describe("createJobLeaseController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("claims once, renews on the heartbeat cadence, and stops cleanly", async () => {
    vi.useFakeTimers();
    const jobsDao = makeJobsDao();
    const claimExecutionLease = vi.mocked(jobsDao.claimExecutionLease);
    const renewExecutionLease = vi.mocked(jobsDao.renewExecutionLease);
    claimExecutionLease.mockResolvedValue({ id: "job-1" } as never);
    renewExecutionLease.mockResolvedValue({ status: "running" });
    const claimedAt = new Date("2026-06-01T12:00:00.000Z");
    const heartbeatAt = new Date("2026-06-01T12:00:30.000Z");
    const now = vi.fn().mockReturnValueOnce(claimedAt).mockReturnValue(heartbeatAt);
    const lease = createJobLeaseController({
      jobsDao,
      jobId: "job-1",
      leaseOwnerId: "worker-1",
      now,
      options: { leaseDurationMs: 90_000, heartbeatIntervalMs: 30_000 },
    });

    await expect(lease.claim()).resolves.toEqual({ id: "job-1" });
    expect(claimExecutionLease).toHaveBeenCalledWith(
      "job-1",
      "worker-1",
      claimedAt,
      new Date("2026-06-01T12:01:30.000Z"),
    );

    lease.start();
    lease.start();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(renewExecutionLease).toHaveBeenCalledTimes(1);
    expect(renewExecutionLease).toHaveBeenCalledWith(
      "job-1",
      "worker-1",
      heartbeatAt,
      new Date("2026-06-01T12:02:00.000Z"),
    );

    lease.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renewExecutionLease).toHaveBeenCalledTimes(1);
  });

  it("stops renewing after another actor finalizes the Job", async () => {
    vi.useFakeTimers();
    const jobsDao = makeJobsDao();
    vi.mocked(jobsDao.renewExecutionLease).mockResolvedValue(undefined);
    const lease = createJobLeaseController({
      jobsDao,
      jobId: "job-2",
      leaseOwnerId: "worker-2",
      now: () => new Date("2026-06-01T12:00:30.000Z"),
      options: { leaseDurationMs: 90_000, heartbeatIntervalMs: 30_000 },
    });

    lease.start();
    await vi.advanceTimersByTimeAsync(30_000);
    await vi.advanceTimersByTimeAsync(90_000);

    expect(jobsDao.renewExecutionLease).toHaveBeenCalledTimes(1);
  });

  it("does not overlap slow heartbeat renewals", async () => {
    vi.useFakeTimers();
    const jobsDao = makeJobsDao();
    const renewExecutionLease = vi.mocked(jobsDao.renewExecutionLease);
    const renewal = { resolve: undefined as (() => void) | undefined };
    renewExecutionLease
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            renewal.resolve = () => resolve({ status: "running" });
          }),
      )
      .mockResolvedValue({ status: "running" });
    const lease = createJobLeaseController({
      jobsDao,
      jobId: "job-slow-heartbeat",
      leaseOwnerId: "worker-slow",
      now: () => new Date("2026-06-01T12:00:30.000Z"),
      options: { leaseDurationMs: 90_000, heartbeatIntervalMs: 30_000 },
    });

    lease.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renewExecutionLease).toHaveBeenCalledTimes(1);

    renewal.resolve?.();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(renewExecutionLease).toHaveBeenCalledTimes(2);
    lease.stop();
  });

  it("rejects lease timing that can expire before the next heartbeat", () => {
    const jobsDao = makeJobsDao();

    expect(() =>
      createJobLeaseController({
        jobsDao,
        jobId: "job-invalid",
        options: { leaseDurationMs: 30_000, heartbeatIntervalMs: 30_000 },
      }),
    ).toThrow("Job heartbeat interval must be less than the lease duration");
  });
});
