import { executionFailure } from "../serviceResult";
import { pauseBriefly } from "../jobRunnerPauseBriefly";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerAwaitRunnableHelper =
  (
    _serviceBindings: Pick<ExecutionJobRunnerBindings, never>,
    ownedJobBindings: Pick<OwnedJobExecutionBindings, "refresh" | "controller" | "convergeWaiting">,
  ) =>
  async () => {
    for (;;) {
      const job = await (0, ownedJobBindings.refresh)();
      if (ownedJobBindings.controller.signal.aborted)
        executionFailure("CANCELLED", "Job execution stopped", undefined, "execution");
      if (job.state === "running") return;
      if (!["pausing", "paused", "waiting_for_input"].includes(job.state))
        executionFailure("JOB_STATE_CONFLICT", "Job is no longer runnable", undefined, "execution");
      await (0, ownedJobBindings.convergeWaiting)();
      await pauseBriefly();
    }
  };
