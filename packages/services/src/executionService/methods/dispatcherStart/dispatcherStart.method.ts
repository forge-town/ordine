import { executionFailure, executionServiceResult } from "../../helpers/serviceResult";

import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherStartMethod =
  (serviceBindings: Pick<ExecutionDispatcherBindings, "state" | "deps" | "poll" | "pollMs">) =>
  () =>
    executionServiceResult(async () => {
      if (serviceBindings.state.started)
        executionFailure("DISPATCHER_ALREADY_STARTED", "Execution dispatcher is already started");
      await serviceBindings.deps.jobs.recoverExpired(serviceBindings.deps.principal.workspaceId);
      await serviceBindings.deps.requests.expirePendingApprovals(
        serviceBindings.deps.principal.workspaceId,
      );
      serviceBindings.state.started = true;
      serviceBindings.state.accepting = true;
      serviceBindings.state.timer = setInterval(serviceBindings.poll, serviceBindings.pollMs);
      (0, serviceBindings.poll)();
    });
