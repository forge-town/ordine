import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";

import type { createJobsDao } from "@repo/models";

export const createFailJobSafelyHelper =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  async (jobId: string, message: string): Promise<void> => {
    const safeTrace = await ResultAsync.fromPromise(
      trace(jobId, `ERROR: ${message}`, "error"),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );
    if (safeTrace.isErr()) {
      logger.error({ err: safeTrace.error, jobId }, "operationRunner: error trace failed");
    }

    const failed = await ResultAsync.fromPromise(
      jobsDao.transitionStatus(jobId, ["queued", "running", "paused"], "failed", {
        finishedAt: new Date(),
        error: message,
      }),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );
    if (failed.isErr()) {
      logger.error({ err: failed.error, jobId }, "operationRunner: failed to finalize job");

      return;
    }
    if (failed.value) return;

    const preserved = await ResultAsync.fromPromise(
      jobsDao.recordErrorIfExpired(jobId, message),
      (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
    );
    if (preserved.isErr()) {
      logger.error(
        { err: preserved.error, jobId },
        "operationRunner: could not preserve provider error on expired job",
      );
    }
  };
