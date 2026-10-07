import type { SchedulerPollerState } from "../../helpers/runTick";
export const createStopMethod = (state: SchedulerPollerState) => () => {
  if (!state.intervalId) return;

  globalThis.clearInterval(state.intervalId);
  state.intervalId = null;
};
