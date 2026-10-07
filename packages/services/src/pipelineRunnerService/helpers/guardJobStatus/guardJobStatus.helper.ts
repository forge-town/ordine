import { ok, err, type Result } from "neverthrow";

import type { JobStatus } from "@repo/schemas";

import type { JobNotFoundError, InvalidJobStatusError } from "../../pipelineRunner.service";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createGuardJobStatusHelper =
  (
    serviceBindings: Pick<
      PipelineRunnerServiceBindings,
      "jobsDao" | "JobNotFoundError" | "InvalidJobStatusError"
    >,
  ) =>
  async (
    action: string,
    jobId: string,
    allowed: readonly JobStatus[],
  ): Promise<Result<void, JobNotFoundError | InvalidJobStatusError>> => {
    const job = await serviceBindings.jobsDao.findById(jobId);
    if (!job) return err(new serviceBindings.JobNotFoundError(jobId));
    if (!allowed.includes(job.status)) {
      return err(new serviceBindings.InvalidJobStatusError(action, jobId, job.status, allowed));
    }

    return ok(undefined);
  };
