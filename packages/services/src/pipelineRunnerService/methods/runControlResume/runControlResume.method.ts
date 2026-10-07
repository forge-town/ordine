import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlResumeMethod =
  (serviceBindings: Pick<RunControlAssemblyBindings, "getState" | "releaseWaiters">) =>
  (jobId: string) => {
    const state = (0, serviceBindings.getState)(jobId);
    state.pauseRequested = false;
    (0, serviceBindings.releaseWaiters)(state);

    return { jobId, resumed: true };
  };
