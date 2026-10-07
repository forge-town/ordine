import type { RunControlState, RunControlAssemblyBindings } from "../../contracts";

export const createRunControlRejectDecisionWaitersHelper =
  (_serviceBindings: Pick<RunControlAssemblyBindings, never>) =>
  (state: RunControlState, jobId: string) => {
    const waiters = [...state.decisionWaiters.values()];
    state.decisionWaiters.clear();
    for (const waiter of waiters) {
      waiter.reject(new Error(`Run ${jobId} was cancelled while waiting for a decision`));
    }
  };
