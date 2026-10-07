import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlCancelMethod =
  (
    serviceBindings: Pick<
      RunControlAssemblyBindings,
      "states" | "releaseWaiters" | "rejectDecisionWaiters"
    >,
  ) =>
  (jobId: string) => {
    // Only flag runs that are live in this process (registered by buildForJob).
    // Cancelling a job with no live run (stuck queued, process restart) is a
    // DB-only action — creating a ghost entry here would never be cleaned up.
    const state = serviceBindings.states.get(jobId);
    if (state) {
      state.cancelRequested = true;
      state.pauseRequested = false;
      state.abortController.abort();
      (0, serviceBindings.releaseWaiters)(state);
      (0, serviceBindings.rejectDecisionWaiters)(state, jobId);
    }

    return { jobId, cancelled: true };
  };
