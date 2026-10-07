import type { RoutineSchedulerDeps, SchedulerRoutine } from "../../contracts";
export const createTickMethod =
  (
    deps: RoutineSchedulerDeps,
    processRoutine: (routine: SchedulerRoutine, now: Date) => Promise<void>,
  ) =>
  async (now = new Date()) => {
    const routines = await deps.getEnabledRoutines();

    for (const routine of routines) {
      // Per-routine isolation: one failing routine must not abort the tick.
      await processRoutine(routine, now).catch((error: unknown) => {
        deps.onError?.(error, routine.id);
      });
    }
  };
