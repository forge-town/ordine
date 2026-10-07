import { createJobsDao, createRoutinesDao, type DbConnection } from "@repo/models";
import { logger } from "@repo/logger";
import {
  DEFAULT_POLL_INTERVAL_MS,
  GRACE_WINDOW_FACTOR,
  DEFAULT_GRACE_WINDOW_MS,
  type RoutineSchedulerDeps,
  type RoutineStartRun,
} from "./contracts";
import { createTickMethod, createStartMethod, createStopMethod } from "./methods";
import {
  createProcessRoutineHelper,
  createRecordSkippedJobHelper,
  createRunTickHelper,
} from "./helpers";
export const createRoutineScheduler = (
  deps: RoutineSchedulerDeps,
  options?: { graceWindowMs?: number },
) => {
  const graceWindowMs = options?.graceWindowMs ?? DEFAULT_GRACE_WINDOW_MS;
  const processRoutine = createProcessRoutineHelper(deps, graceWindowMs);
  const tick = createTickMethod(deps, processRoutine);

  return { tick };
};

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
  const recordSkippedJob = createRecordSkippedJobHelper(jobsDao);

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
  const runTick = createRunTickHelper(state, scheduler);
  const start = createStartMethod(state, runTick, pollIntervalMs);
  const stop = createStopMethod(state);

  return {
    start,
    stop,
    tick: scheduler.tick,
  };
};
