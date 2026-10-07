import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerLoseLeaseHelper =
  (
    _serviceBindings: Pick<ExecutionJobRunnerBindings, never>,
    ownedJobBindings: Pick<OwnedJobExecutionBindings, "state" | "abortWith">,
  ) =>
  () => {
    ownedJobBindings.state.uncertain = true;
    (0, ownedJobBindings.abortWith)({
      code: "EXECUTION_LEASE_LOST",
      message: "Lease renewal was not confirmed before the execution safety deadline",
      stage: "execution",
      retryable: false,
    });
  };
