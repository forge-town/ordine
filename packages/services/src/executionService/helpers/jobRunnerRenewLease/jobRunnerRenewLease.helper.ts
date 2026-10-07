import { executionFailure, executionServiceResult } from "../serviceResult";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerRenewLeaseHelper =
  (
    serviceBindings: Pick<ExecutionJobRunnerBindings, "deps" | "leaseMs" | "heartbeatMs">,
    ownedJobBindings: Pick<
      OwnedJobExecutionBindings,
      "state" | "lease" | "observe" | "abortWith" | "loseLease"
    >,
  ) =>
  () => {
    if (ownedJobBindings.state.done || ownedJobBindings.state.heartbeat) return;
    // Measure from request dispatch, not response arrival: a delayed DB reply
    // must never grant extra local execution time. PostgreSQL remains the lease authority.
    const sentAt = performance.now();
    ownedJobBindings.state.heartbeat = executionServiceResult(async () => {
      const job = await serviceBindings.deps.jobs.heartbeat(
        ownedJobBindings.lease,
        serviceBindings.leaseMs,
      );
      if (!job)
        executionFailure(
          "EXECUTION_LEASE_LOST",
          "Executor lease is no longer valid",
          undefined,
          "execution",
        );
      (0, ownedJobBindings.observe)(job);
    }).then((result) => {
      if (!ownedJobBindings.state.done && result.isErr()) {
        ownedJobBindings.state.uncertain = true;
        (0, ownedJobBindings.abortWith)(result.error);
      } else if (!ownedJobBindings.state.done) {
        const deadline = sentAt + serviceBindings.leaseMs - serviceBindings.heartbeatMs;
        if (performance.now() >= deadline) (0, ownedJobBindings.loseLease)();
        else ownedJobBindings.state.leaseDeadline = deadline;
      }
      ownedJobBindings.state.heartbeat = undefined;
    });

    return ownedJobBindings.state.heartbeat;
  };
