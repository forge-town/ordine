import { ResultAsync } from "neverthrow";

import { logger } from "@repo/logger";

import type { JobsDao } from "@repo/models";

import type { RunPipelineAssemblyBindings } from "../../contracts";
export const createRunPipelineRecordUsageOnFinalizedJobSafelyHelper =
  (_serviceBindings: Pick<RunPipelineAssemblyBindings, never>) =>
  async ({
    jobsDao,
    jobId,
    usageTotals,
  }: {
    jobsDao: JobsDao;
    jobId: string;
    usageTotals?: { totalTokens: number };
  }): Promise<void> => {
    if (!usageTotals) return;

    const safeUpdate = await ResultAsync.fromPromise(
      jobsDao.updateUsageTotals(jobId, usageTotals.totalTokens),
      (e) => e,
    );
    if (safeUpdate.isErr()) {
      logger.warn(
        { err: safeUpdate.error, jobId },
        "runPipeline: failed to record usage totals on finalized job",
      );
    }
  };
