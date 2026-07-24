import type {
  DecisionResult,
  PipelineDecisionEvent,
  PipelineRunControl,
  PipelineRunControlEvent,
} from "@repo/pipeline-engine";

type ResumeWaiter = () => void;
type DecisionWaiter = {
  resolve: (result: DecisionResult) => void;
  reject: (error: Error) => void;
};

type RunControlState = {
  pauseRequested: boolean;
  cancelRequested: boolean;
  waiters: ResumeWaiter[];
  decisionWaiters: Map<string, DecisionWaiter>;
};

const states = new Map<string, RunControlState>();

const getState = (jobId: string): RunControlState => {
  const existing = states.get(jobId);
  if (existing) return existing;

  const state = {
    pauseRequested: false,
    cancelRequested: false,
    waiters: [],
    decisionWaiters: new Map(),
  };
  states.set(jobId, state);

  return state;
};

const releaseWaiters = (state: RunControlState) => {
  const waiters = state.waiters;
  state.waiters = [];
  for (const waiter of waiters) {
    waiter();
  }
};

const rejectDecisionWaiters = (state: RunControlState, jobId: string) => {
  const waiters = [...state.decisionWaiters.values()];
  state.decisionWaiters.clear();
  for (const waiter of waiters) {
    waiter.reject(new Error(`Run ${jobId} was cancelled while waiting for a decision`));
  }
};

/**
 * In-process control container for pipeline runs, keyed by jobId.
 *
 * Semantics (product decisions for the runner):
 * - Pause is a node-boundary pause: the current node finishes, then the engine
 *   suspends before starting the next node until resume releases it.
 * - Cancel is a soft cancel: the cancel flag is set and every waiter is
 *   released/rejected so the engine stops at the next node boundary; a node
 *   that is already executing is never force-killed. State cleanup happens
 *   when the run settles (clear), not at cancel time.
 * - Decision nodes suspend the engine until the user resolves the decision.
 */
export const pipelineRunControl = {
  buildForJob: (jobId: string): PipelineRunControl => {
    // Register the state eagerly so a cancel that lands right after startRun
    // (before the engine's first boundary check) is not lost.
    getState(jobId);

    return {
      shouldPauseBeforeNode: () => getState(jobId).pauseRequested,
      shouldCancelBeforeNode: () => getState(jobId).cancelRequested,
      waitForResume: (event: PipelineRunControlEvent) => {
        const state = getState(event.jobId);
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
          const state = getState(event.jobId);
          if (state.cancelRequested) {
            reject(new Error(`Run ${event.jobId} was cancelled while waiting for a decision`));

            return;
          }
          state.decisionWaiters.set(event.nodeId, { resolve, reject });
        }),
    };
  },

  /** Final cleanup once the run has settled; releases anything still parked, defensively. */
  clear: (jobId: string) => {
    const state = states.get(jobId);
    if (!state) return;

    state.pauseRequested = false;
    releaseWaiters(state);
    rejectDecisionWaiters(state, jobId);
    states.delete(jobId);
  },

  pause: (jobId: string) => {
    getState(jobId).pauseRequested = true;

    return { jobId, paused: true };
  },

  resume: (jobId: string) => {
    const state = getState(jobId);
    state.pauseRequested = false;
    releaseWaiters(state);

    return { jobId, resumed: true };
  },

  /**
   * Soft cancel: set the cancel flag, wake every parked resume waiter (the
   * engine re-checks the cancel flag after waking and stops), and reject every
   * pending decision waiter (the engine converts the rejection into a node
   * failure so the run settles). Keeps the state alive until clear() runs on
   * settle, so boundary checks keep seeing the cancel flag.
   */
  cancel: (jobId: string) => {
    // Only flag runs that are live in this process (registered by buildForJob).
    // Cancelling a job with no live run (stuck queued, process restart) is a
    // DB-only action — creating a ghost entry here would never be cleaned up.
    const state = states.get(jobId);
    if (state) {
      state.cancelRequested = true;
      state.pauseRequested = false;
      releaseWaiters(state);
      rejectDecisionWaiters(state, jobId);
    }

    return { jobId, cancelled: true };
  },

  /**
   * Apply the user's decision: wake the suspended decision node (the engine
   * never picks a default). `selectedCandidateIds` are the candidateId values
   * from PipelineDecisionEvent.candidates (the incoming edge ids), not node ids.
   */
  resolveDecision: (jobId: string, nodeId: string, selectedCandidateIds: string[]) => {
    const state = getState(jobId);
    const waiter = state.decisionWaiters.get(nodeId);
    if (waiter) {
      state.decisionWaiters.delete(nodeId);
      waiter.resolve({ selectedCandidateIds });
    }

    return { jobId, nodeId, resolved: Boolean(waiter) };
  },
};
