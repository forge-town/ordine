import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlResolveDecisionMethod =
  (serviceBindings: Pick<RunControlAssemblyBindings, "getState">) =>
  (jobId: string, nodeId: string, selectedCandidateIds: string[]) => {
    const state = (0, serviceBindings.getState)(jobId);
    const waiter = state.decisionWaiters.get(nodeId);
    if (waiter) {
      state.decisionWaiters.delete(nodeId);
      waiter.resolve({ selectedCandidateIds });
    }

    return { jobId, nodeId, resolved: Boolean(waiter) };
  };
