import { createJobsDao, createRoutinesDao, type DbConnection } from "@repo/models";
import { logger } from "@repo/logger";
import {
  createRoutineScheduler,
  DEFAULT_POLL_INTERVAL_MS,
  GRACE_WINDOW_FACTOR,
  type RoutineStartRun,
  type SkippedJobInput,
} from "./routineScheduler";

/**
 * In-process poller around the pure routine scheduler.
 *
 * Skipped history entries are persisted as jobs with status "skipped" and
 * triggeredBy "routine"; the skip reason lands in the job's error column.
 * There is no runtime assembly point on develop yet, so callers (app wiring)
 * are expected to construct this service with the pipeline runner's startRun
 * and invoke start() exactly once per process.
 */
export const createRoutineSchedulerService = (
  db: DbConnection,
  deps: {
    startRun: RoutineStartRun;
  },
  options?: {
    pollIntervalMs?: number;
  },
) => {
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const routinesDao = createRoutinesDao(db);
  const jobsDao = createJobsDao(db);

  const recordSkippedJob = ({ pipelineId, routineName, reason }: SkippedJobInput) =>
    jobsDao.create({
      id: crypto.randomUUID(),
      title: `Routine skipped: ${routineName}`,
      type: "pipeline_run",
      status: "skipped",
      triggeredBy: "routine",
      pipelineId,
      parentJobId: null,
      error: reason,
      startedAt: null,
      finishedAt: new Date(),
    });

  const scheduler = createRoutineScheduler(
    {
      getEnabledRoutines: () => routinesDao.findManyEnabled(),
      claimNextRun: (id, scheduledAt, nextRunAt) =>
        routinesDao.claimNextRun(id, scheduledAt, nextRunAt),
      startRun: deps.startRun,
      updateRoutine: (id, patch) => routinesDao.update(id, patch),
      recordSkippedJob,
      onError: (error, routineId) => {
        logger.error({ err: error, routineId }, "routineScheduler: routine processing failed");
      },
    },
    { graceWindowMs: GRACE_WINDOW_FACTOR * pollIntervalMs },
  );

  const state: {
    intervalId: ReturnType<typeof globalThis.setInterval> | null;
    ticking: boolean;
  } = {
    intervalId: null,
    ticking: false,
  };

  // In-flight guard: if the previous tick is still running (slow DB, many due
  // routines), skip this interval instead of re-entering and double-triggering.
  const runTick = () => {
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

  const start = () => {
    if (state.intervalId) return;

    state.intervalId = globalThis.setInterval(runTick, pollIntervalMs);
    runTick();
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
