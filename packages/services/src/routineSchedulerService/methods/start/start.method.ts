import type { SchedulerPollerState } from "../../helpers/runTick";
export const createStartMethod =
  (state: SchedulerPollerState, runTick: () => void, pollIntervalMs: number) => () => {
    if (state.intervalId) return;

    state.intervalId = globalThis.setInterval(runTick, pollIntervalMs);
    runTick();
  };
