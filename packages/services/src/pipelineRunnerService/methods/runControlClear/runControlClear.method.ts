import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlClearMethod =
  (
    serviceBindings: Pick<
      RunControlAssemblyBindings,
      "states" | "releaseWaiters" | "rejectDecisionWaiters"
    >,
  ) =>
  (jobId: string) => {
    const state = serviceBindings.states.get(jobId);
    if (!state) return;

    state.pauseRequested = false;
    (0, serviceBindings.releaseWaiters)(state);
    (0, serviceBindings.rejectDecisionWaiters)(state, jobId);
    serviceBindings.states.delete(jobId);
  };
