import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlSignalMethod =
  (serviceBindings: Pick<RunControlAssemblyBindings, "getState">) =>
  (jobId: string): AbortSignal =>
    (0, serviceBindings.getState)(jobId).abortController.signal;
