import { ResultAsync } from "neverthrow";

import type { JobStatus } from "@repo/schemas";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createPersistStatusHelper =
  (serviceBindings: Pick<PipelineRunnerServiceBindings, "jobsDao">) =>
  (
    jobId: string,
    from: readonly JobStatus[],
    status: JobStatus,
    extra?: { finishedAt?: Date },
  ): ResultAsync<unknown, Error> =>
    ResultAsync.fromPromise(
      serviceBindings.jobsDao.transitionStatus(jobId, from, status, extra),
      (cause) =>
        new Error(
          `Failed to persist status "${status}" for job ${jobId}: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
    );
