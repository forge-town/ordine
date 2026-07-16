import type {
  DecisionResult,
  PipelineDecisionEvent,
  PipelineRunControl,
  PipelineRunControlEvent,
} from "@repo/pipeline-engine";

type ResumeWaiter = () => void;
type DecisionWaiter = (result: DecisionResult) => void;

type RunControlState = {
  pauseRequested: boolean;
  waiters: ResumeWaiter[];
  decisionWaiters: Map<string, DecisionWaiter>;
};

const states = new Map<string, RunControlState>();

const getState = (jobId: string): RunControlState => {
  const existing = states.get(jobId);
  if (existing) return existing;

  const state = { pauseRequested: false, waiters: [], decisionWaiters: new Map() };
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

/**
 * In-process control container for pipeline runs, keyed by jobId.
 *
 * Semantics (product decisions for the runner):
 * - Pause is a node-boundary pause: the current node finishes, then the engine
 *   suspends before starting the next node until resume releases it.
 * - Cancel is a soft cancel: the job is marked cancelled and all waiters are
 *   released; a node that is already executing is never force-killed.
 * - Decision nodes suspend the engine until the user resolves the decision.
 */
export const pipelineRunControl = {
  buildForJob: (jobId: string): PipelineRunControl => ({
    shouldPauseBeforeNode: () => getState(jobId).pauseRequested,
    waitForResume: (event: PipelineRunControlEvent) => {
      const state = getState(event.jobId);
      state.pauseRequested = true;

      return new Promise<void>((resolve) => {
        state.waiters.push(resolve);
      });
    },
    waitForDecision: (event: PipelineDecisionEvent) =>
      new Promise<DecisionResult>((resolve) => {
        getState(event.jobId).decisionWaiters.set(event.nodeId, resolve);
      }),
  }),

  clear: (jobId: string) => {
    const state = states.get(jobId);
    if (!state) return;

    state.pauseRequested = false;
    releaseWaiters(state);
    state.decisionWaiters.clear();
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

  /** Apply the user's decision: wake the suspended decision node (the engine never picks a default). */
  resolveDecision: (jobId: string, nodeId: string, selectedCandidateIds: string[]) => {
    const state = getState(jobId);
    const waiter = state.decisionWaiters.get(nodeId);
    if (waiter) {
      state.decisionWaiters.delete(nodeId);
      waiter({ selectedCandidateIds });
    }

    return { jobId, nodeId, resolved: Boolean(waiter) };
  },
};
