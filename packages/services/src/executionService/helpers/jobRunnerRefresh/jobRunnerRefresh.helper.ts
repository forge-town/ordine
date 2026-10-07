import { executionFailure } from "../serviceResult";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerRefreshHelper =
  (
    serviceBindings: Pick<ExecutionJobRunnerBindings, "deps">,
    ownedJobBindings: Pick<OwnedJobExecutionBindings, "lease" | "observe">,
  ) =>
  async () => {
    const job = await serviceBindings.deps.requests.getJob(
      ownedJobBindings.lease,
      ownedJobBindings.lease.jobId,
    );
    if (!job) executionFailure("NOT_FOUND", "Owned Job disappeared");
    (0, ownedJobBindings.observe)(job);

    return job;
  };
