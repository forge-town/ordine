import type { ExecutionError } from "@repo/schemas";
import type { ExecutionJobRunnerBindings, OwnedJobExecutionBindings } from "../../contracts";

export const createJobRunnerAbortWithHelper =
  (
    _serviceBindings: Pick<ExecutionJobRunnerBindings, never>,
    ownedJobBindings: Pick<OwnedJobExecutionBindings, "state" | "controller">,
  ) =>
  (error: ExecutionError) => {
    ownedJobBindings.state.error ??= error;
    ownedJobBindings.controller.abort(error);
  };
