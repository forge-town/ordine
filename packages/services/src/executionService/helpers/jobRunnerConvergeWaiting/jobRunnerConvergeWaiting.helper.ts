import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerConvergeWaitingHelper =
  (
    serviceBindings: Pick<ExecutionJobRunnerBindings, "deps">,
    ownedJobBindings: Pick<
      OwnedJobExecutionBindings,
      "refresh" | "controller" | "activeAttempts" | "observe" | "lease" | "checkpoints"
    >,
  ) =>
  async () => {
    const job = await (0, ownedJobBindings.refresh)();
    if (ownedJobBindings.controller.signal.aborted || ownedJobBindings.activeAttempts.size > 0)
      return;
    if (job.state === "pausing")
      (0, ownedJobBindings.observe)(
        await serviceBindings.deps.jobs.enterWaiting(ownedJobBindings.lease, "paused"),
      );
    else if (ownedJobBindings.checkpoints.size > 0 && job.state === "running")
      (0, ownedJobBindings.observe)(
        await serviceBindings.deps.jobs.enterWaiting(ownedJobBindings.lease, "waiting_for_input"),
      );
  };
