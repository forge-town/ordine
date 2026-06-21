import type { Result } from "neverthrow";
import { createRoutinesDao, type DbConnection } from "@repo/models";
import type { JobTriggeredBy } from "@repo/schemas";
import { createRoutineScheduler } from "./routineScheduler";

const DEFAULT_POLL_INTERVAL_MS = 30_000;

type StartRun = (opts: {
  inputs?: Record<string, string>;
  pipelineId: string;
  triggeredBy: JobTriggeredBy;
}) => Promise<Result<{ jobId: string }, unknown>>;

export const createRoutineSchedulerService = (
  db: DbConnection,
  deps: {
    startRun: StartRun;
  },
) => {
  const routinesDao = createRoutinesDao(db);
  const scheduler = createRoutineScheduler({
    getEnabledRoutines: () => routinesDao.getEnabled(),
    startRun: deps.startRun,
    updateRoutine: (id, patch) => routinesDao.update(id, patch),
  });
  const state: { intervalId: ReturnType<typeof globalThis.setInterval> | null } = {
    intervalId: null,
  };

  const start = (pollIntervalMs = DEFAULT_POLL_INTERVAL_MS) => {
    if (state.intervalId) return;

    state.intervalId = globalThis.setInterval(() => {
      void scheduler.tick();
    }, pollIntervalMs);
    void scheduler.tick();
  };

  const stop = () => {
    if (!state.intervalId) return;

    globalThis.clearInterval(state.intervalId);
    state.intervalId = null;
  };

  return {
    start,
    stop,
    tick: scheduler.tick,
  };
};
