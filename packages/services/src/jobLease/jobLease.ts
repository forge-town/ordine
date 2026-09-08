import { ResultAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { JobsDao } from "@repo/models";

export const DEFAULT_JOB_LEASE_DURATION_MS = 90_000;
export const DEFAULT_JOB_HEARTBEAT_INTERVAL_MS = 30_000;

export type JobLeaseTimingOptions = {
  leaseDurationMs?: number;
  heartbeatIntervalMs?: number;
};

export const createJobLeaseController = ({
  jobsDao,
  jobId,
  options,
  leaseOwnerId = crypto.randomUUID(),
  now = () => new Date(),
}: {
  jobsDao: JobsDao;
  jobId: string;
  options?: JobLeaseTimingOptions;
  leaseOwnerId?: string;
  now?: () => Date;
}) => {
  const leaseDurationMs = options?.leaseDurationMs ?? DEFAULT_JOB_LEASE_DURATION_MS;
  const heartbeatIntervalMs = options?.heartbeatIntervalMs ?? DEFAULT_JOB_HEARTBEAT_INTERVAL_MS;
  if (leaseDurationMs <= 0 || heartbeatIntervalMs <= 0) {
    throw new Error("Job lease duration and heartbeat interval must be positive");
  }
  if (heartbeatIntervalMs >= leaseDurationMs) {
    throw new Error("Job heartbeat interval must be less than the lease duration");
  }
  const state: {
    heartbeatTimer: ReturnType<typeof globalThis.setInterval> | null;
    heartbeatRunning: boolean;
  } = {
    heartbeatTimer: null,
    heartbeatRunning: false,
  };

  const stop = () => {
    if (!state.heartbeatTimer) return;

    globalThis.clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  };

  const heartbeat = async (): Promise<void> => {
    if (state.heartbeatRunning) return;

    state.heartbeatRunning = true;
    const heartbeatAt = now();
    const renewed = await ResultAsync.fromPromise(
      jobsDao.renewExecutionLease(
        jobId,
        leaseOwnerId,
        heartbeatAt,
        new Date(heartbeatAt.getTime() + leaseDurationMs),
      ),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );
    state.heartbeatRunning = false;
    if (renewed.isErr()) {
      logger.warn({ err: renewed.error, jobId, leaseOwnerId }, "job lease heartbeat failed");

      return;
    }
    if (!renewed.value) stop();
  };

  return {
    leaseOwnerId,
    claim: () => {
      const claimedAt = now();

      return jobsDao.claimExecutionLease(
        jobId,
        leaseOwnerId,
        claimedAt,
        new Date(claimedAt.getTime() + leaseDurationMs),
      );
    },
    start: () => {
      if (state.heartbeatTimer) return;

      state.heartbeatTimer = globalThis.setInterval(() => {
        void heartbeat();
      }, heartbeatIntervalMs);
    },
    stop,
  };
};
