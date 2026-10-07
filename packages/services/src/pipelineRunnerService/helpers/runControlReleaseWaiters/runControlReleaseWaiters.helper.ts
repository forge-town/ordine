import type { RunControlState, RunControlAssemblyBindings } from "../../contracts";

export const createRunControlReleaseWaitersHelper =
  (_serviceBindings: Pick<RunControlAssemblyBindings, never>) => (state: RunControlState) => {
    const waiters = state.waiters;
    state.waiters = [];
    for (const waiter of waiters) {
      waiter();
    }
  };
