import type { RunControlState, RunControlAssemblyBindings } from "../../contracts";

export const createRunControlGetStateHelper =
  (serviceBindings: Pick<RunControlAssemblyBindings, "states">) =>
  (jobId: string): RunControlState => {
    const existing = serviceBindings.states.get(jobId);
    if (existing) return existing;

    const state = {
      pauseRequested: false,
      cancelRequested: false,
      abortController: new AbortController(),
      waiters: [],
      decisionWaiters: new Map(),
    };
    serviceBindings.states.set(jobId, state);

    return state;
  };
