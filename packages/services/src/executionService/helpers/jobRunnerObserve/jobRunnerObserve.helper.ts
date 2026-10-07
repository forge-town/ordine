import type { ExecutionJobRecord } from "@repo/db-schema";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerObserveHelper =
  (
    _serviceBindings: Pick<ExecutionJobRunnerBindings, never>,
    ownedJobBindings: Pick<OwnedJobExecutionBindings, "state" | "controller">,
  ) =>
  (job: ExecutionJobRecord) => {
    ownedJobBindings.state.job = job;
    if (job.state === "cancelling" || job.stopReason)
      ownedJobBindings.controller.abort(job.stopReason ?? "cancelled");
  };
