import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { logger } from "@repo/logger";

import type { JobsDao } from "@repo/models";

import type { RunPipelineAssemblyBindings } from "../../contracts";
export const createRunPipelineFailJobSafelyHelper =
  (_serviceBindings: Pick<RunPipelineAssemblyBindings, never>) =>
  async ({
    jobsDao,
    jobId,
    message,
    usageTotals,
  }: {
    jobsDao: JobsDao;
    jobId: string;
    message: string;
    usageTotals?: { totalTokens: number };
  }): Promise<void> => {
    const safeTrace = await ResultAsync.fromPromise(
      trace(jobId, `ERROR: ${message}`, "error"),
      (e) => e,
    );
    if (safeTrace.isErr()) {
      logger.error(
        { err: safeTrace.error, jobId },
        "runPipeline: trace failed during error handling",
      );
    }

    const safeUpdate = await ResultAsync.fromPromise(
      jobsDao.transitionStatus(jobId, ["queued", "running", "paused"], "failed", {
        finishedAt: new Date(),
        error: message,
        ...usageTotals,
      }),
      (e) => e,
    );
    if (safeUpdate.isErr()) {
      logger.error(
        { err: safeUpdate.error, jobId },
        "runPipeline: CRITICAL — could not mark job as failed",
      );

      return;
    }
    if (safeUpdate.value) return;

    const preservedError = await ResultAsync.fromPromise(
      jobsDao.recordErrorIfExpired(jobId, message),
      (e) => e,
    );
    if (preservedError.isErr()) {
      logger.error(
        { err: preservedError.error, jobId },
        "runPipeline: could not preserve provider error on expired job",
      );

      return;
    }
    logger.info(
      { jobId, errorPreserved: Boolean(preservedError.value) },
      "runPipeline: job already finalized elsewhere — not overwriting with failed",
    );
  };
