import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlPauseMethod =
  (serviceBindings: Pick<RunControlAssemblyBindings, "getState">) => (jobId: string) => {
    (0, serviceBindings.getState)(jobId).pauseRequested = true;

    return { jobId, paused: true };
  };
