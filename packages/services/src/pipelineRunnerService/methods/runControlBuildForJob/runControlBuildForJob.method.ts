import type {
  DecisionResult,
  PipelineDecisionEvent,
  PipelineRunControl,
  PipelineRunControlEvent,
} from "@repo/pipeline-engine";

import type { RunControlAssemblyBindings } from "../../contracts";
export const createRunControlBuildForJobMethod =
  (serviceBindings: Pick<RunControlAssemblyBindings, "getState">) =>
  (jobId: string): PipelineRunControl => {
    // Register the state eagerly so a cancel that lands right after startRun
    // (before the engine's first boundary check) is not lost.
    (0, serviceBindings.getState)(jobId);

    return {
      shouldPauseBeforeNode: () => (0, serviceBindings.getState)(jobId).pauseRequested,
      shouldCancelBeforeNode: () => (0, serviceBindings.getState)(jobId).cancelRequested,
      waitForResume: (event: PipelineRunControlEvent) => {
        const state = (0, serviceBindings.getState)(event.jobId);
        // A cancelled run must never park on a resume waiter.
        if (state.cancelRequested) return Promise.resolve();

        if (event.reason === "pause") {
          // Lost-resume race: resume may have landed between the pause check and
          // this wait. If the pause request is already cleared, proceed at once
          // instead of re-arming it and waiting forever.
          if (!state.pauseRequested) return Promise.resolve();
        } else {
          // Checkpoint waits always require an explicit resume; surface the
          // suspension to shouldPauseBeforeNode for any parallel branches.
          state.pauseRequested = true;
        }

        return new Promise<void>((resolve) => {
          state.waiters.push(resolve);
        });
      },
      waitForDecision: (event: PipelineDecisionEvent) =>
        new Promise<DecisionResult>((resolve, reject) => {
          const state = (0, serviceBindings.getState)(event.jobId);
          if (state.cancelRequested) {
            reject(new Error(`Run ${event.jobId} was cancelled while waiting for a decision`));

            return;
          }
          state.decisionWaiters.set(event.nodeId, { resolve, reject });
        }),
    };
  };
