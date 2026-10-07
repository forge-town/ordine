import { logger } from "@repo/logger";
export type SchedulerPollerState = {
  intervalId: ReturnType<typeof globalThis.setInterval> | null;
  ticking: boolean;
};
export const createRunTickHelper =
  (state: SchedulerPollerState, scheduler: { tick: () => Promise<void> }) => () => {
    if (state.ticking) return;

    state.ticking = true;
    void scheduler
      .tick()
      .catch((error: unknown) => {
        logger.error({ err: error }, "routineScheduler: tick failed");
      })
      .finally(() => {
        state.ticking = false;
      });
  };
