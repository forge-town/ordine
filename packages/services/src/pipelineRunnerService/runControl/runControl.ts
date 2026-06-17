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

  /** 落地用户决策：唤醒挂起的决策节点（绝不在引擎侧默认选择）。 */
  resolveDecision: (jobId: string, nodeId: string, selectedNodeIds: string[]) => {
    const state = getState(jobId);
    const waiter = state.decisionWaiters.get(nodeId);
    if (waiter) {
      state.decisionWaiters.delete(nodeId);
      waiter({ selectedNodeIds });
    }

    return { jobId, nodeId, resolved: Boolean(waiter) };
  },
};
