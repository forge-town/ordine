import type { PipelineRunControl, PipelineRunControlEvent } from "@repo/pipeline-engine";

type ResumeWaiter = () => void;

type RunControlState = {
  pauseRequested: boolean;
  waiters: ResumeWaiter[];
};

const states = new Map<string, RunControlState>();

const getState = (jobId: string): RunControlState => {
  const existing = states.get(jobId);
  if (existing) return existing;

  const state = { pauseRequested: false, waiters: [] };
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
  }),

  clear: (jobId: string) => {
    const state = states.get(jobId);
    if (!state) return;

    state.pauseRequested = false;
    releaseWaiters(state);
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
};
