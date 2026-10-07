import { executionServiceResult } from "../serviceResult";

import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherPollHelper =
  (
    serviceBindings: Pick<
      ExecutionDispatcherBindings,
      "state" | "deps" | "active" | "maxJobs" | "leaseMs"
    >,
  ) =>
  () => {
    if (!serviceBindings.state.accepting || serviceBindings.state.tick) return;
    serviceBindings.state.tick = Promise.resolve(
      executionServiceResult(async () => {
        await serviceBindings.deps.requests.expirePendingApprovals(
          serviceBindings.deps.principal.workspaceId,
        );
        await serviceBindings.deps.jobs.recoverExpired(serviceBindings.deps.principal.workspaceId);
        while (
          serviceBindings.state.accepting &&
          serviceBindings.active.size < serviceBindings.maxJobs
        ) {
          const claimed = await serviceBindings.deps.jobs.claimNext(
            serviceBindings.deps.principal.workspaceId,
            serviceBindings.deps.instanceId,
            serviceBindings.leaseMs,
          );
          if (!claimed) break;
          const controller = new AbortController();
          const task = Promise.resolve(
            serviceBindings.deps.runner.run(claimed, controller.signal),
          ).then((result) => {
            if (result.isErr()) serviceBindings.state.lastError = result.error;
            serviceBindings.active.delete(claimed.id);
          });
          serviceBindings.active.set(claimed.id, { controller, task });
          if (!serviceBindings.state.accepting) controller.abort();
        }
      }),
    ).then((result) => {
      if (result.isErr()) serviceBindings.state.lastError = result.error;
      serviceBindings.state.tick = undefined;
    });
  };
