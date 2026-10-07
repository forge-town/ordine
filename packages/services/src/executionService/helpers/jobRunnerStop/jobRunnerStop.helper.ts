import { executionServiceResult } from "../serviceResult";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerStopHelper =
  (
    serviceBindings: Pick<ExecutionJobRunnerBindings, "deps">,
    ownedJobBindings: Pick<
      OwnedJobExecutionBindings,
      "state" | "observe" | "principal" | "lease" | "abortWith"
    >,
  ) =>
  () => {
    if (ownedJobBindings.state.done || ownedJobBindings.state.stop) return;
    ownedJobBindings.state.stop = executionServiceResult(async () => {
      (0, ownedJobBindings.observe)(
        await serviceBindings.deps.jobs.requestControl(
          ownedJobBindings.principal,
          ownedJobBindings.lease.jobId,
          "cancel",
        ),
      );
    }).then((result) => {
      if (result.isErr()) {
        ownedJobBindings.state.uncertain = true;
        (0, ownedJobBindings.abortWith)(result.error);
      }
    });
  };
