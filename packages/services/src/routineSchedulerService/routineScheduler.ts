import { ResultAsync, type Result } from "neverthrow";
import { getNextCronRunAt, toStringInputs } from "@repo/utils";
import type { JobTriggeredBy } from "@repo/schemas";

/** Default polling interval for the in-process scheduler. */
export const DEFAULT_POLL_INTERVAL_MS = 30_000;

/**
 * Grace window multiplier applied to the polling interval.
 *
 * A due run is only started while it is at most `GRACE_WINDOW_FACTOR *
 * pollIntervalMs` late, so a single delayed poll cannot demote an on-time run
 * to "missed". Anything older (e.g. the process was down across the scheduled
 * time) is recorded as a skipped job and is never retried or backfilled.
 */
export const GRACE_WINDOW_FACTOR = 2;
export const DEFAULT_GRACE_WINDOW_MS = GRACE_WINDOW_FACTOR * DEFAULT_POLL_INTERVAL_MS;

export type SchedulerRoutine = {
  id: string;
  pipelineId: string;
  name: string;
  cronExpression: string | null;
  inputConfig: Record<string, unknown> | null;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
};

type RoutinePatch = {
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
};

export type RoutineStartRun = (opts: {
  inputs?: Record<string, string>;
  pipelineId: string;
  triggeredBy?: JobTriggeredBy;
}) => Promise<Result<{ jobId: string }, Error>>;

export type SkippedJobInput = {
  pipelineId: string;
  routineId: string;
  routineName: string;
  reason: string;
};

export type RoutineSchedulerDeps = {
  getEnabledRoutines: () => Promise<SchedulerRoutine[]>;
  startRun: RoutineStartRun;
  updateRoutine: (id: string, patch: RoutinePatch) => Promise<unknown>;
  recordSkippedJob: (input: SkippedJobInput) => Promise<unknown>;
  /** Invoked when processing a single routine throws; the tick continues. */
  onError?: (error: unknown, routineId: string) => void;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Pure scheduler tick over enabled routines. Semantics per routine:
 *
 * - nextRunAt is null: compute it from the cron expression and wait for the
 *   next window (never run immediately on discovery).
 * - nextRunAt is in the future: nothing to do.
 * - due within the grace window: start the run. A failed start (error Result
 *   or rejection) is recorded as a skipped job with the failure reason; there
 *   is no retry and the schedule advances to the next occurrence.
 * - due but past the grace window (the process was offline across the
 *   scheduled time): record a single skipped job covering the oldest missed
 *   window and everything missed after it, then advance the schedule. Missed
 *   runs are never backfilled.
 *
 * On the start-run and missed-window failure paths the schedule is advanced
 * BEFORE the skipped record is written: if persisting the skipped job fails,
 * the next tick must not retry the same window. If advancing the routine itself
 * throws, the schedule does not advance and the tick's per-routine error
 * handler is invoked.
 *
 * Errors thrown while processing one routine are reported via deps.onError
 * and do not abort the tick for the remaining routines.
 *
 * Time semantics: cron expressions are interpreted in the server's local
 * timezone (see the cron module in @repo/utils). A DST fall-back transition
 * does not double-run a routine; a spring-forward gap rolls the occurrence
 * forward to the next valid local time without recording a skipped entry.
 *
 * Single-instance assumption: nothing prevents two processes polling the same
 * database from double-triggering a routine. Multi-instance coordination is
 * intentionally out of scope.
 */
export const createRoutineScheduler = (
  deps: RoutineSchedulerDeps,
  options?: { graceWindowMs?: number },
) => {
  const graceWindowMs = options?.graceWindowMs ?? DEFAULT_GRACE_WINDOW_MS;

  const processRoutine = async (routine: SchedulerRoutine, now: Date) => {
    if (!routine.enabled) return;

    const scheduledAt = routine.nextRunAt;
    if (!scheduledAt) {
      const upcoming = getNextCronRunAt(routine.cronExpression, now);
      if (upcoming) {
        await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
      }

      return;
    }

    if (scheduledAt.getTime() > now.getTime()) return;

    const upcoming = getNextCronRunAt(routine.cronExpression, now);
    const lateByMs = now.getTime() - scheduledAt.getTime();

    if (lateByMs > graceWindowMs) {
      // Advance first so a failing skipped-write cannot re-trigger this window.
      await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
      await deps.recordSkippedJob({
        pipelineId: routine.pipelineId,
        routineId: routine.id,
        routineName: routine.name,
        reason: `Missed scheduled run at ${scheduledAt.toISOString()} and all subsequently missed windows while the scheduler was offline; missed runs are not backfilled`,
      });

      return;
    }

    // The startRun Result must be checked: a failed trigger (error Result
    // or rejected promise) becomes a skipped history entry instead of being
    // silently swallowed.
    const startResult = await ResultAsync.fromPromise(
      deps.startRun({
        inputs: toStringInputs(routine.inputConfig),
        pipelineId: routine.pipelineId,
        triggeredBy: "routine",
      }),
      (error) => error,
    ).andThen((result) => result);

    if (startResult.isOk()) {
      await deps.updateRoutine(routine.id, { lastRunAt: now, nextRunAt: upcoming });
    } else {
      // Advance first so a failing skipped-write cannot re-trigger this window.
      await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
      await deps.recordSkippedJob({
        pipelineId: routine.pipelineId,
        routineId: routine.id,
        routineName: routine.name,
        reason: `Failed to start scheduled run: ${describeError(startResult.error)}`,
      });
    }
  };

  const tick = async (now = new Date()) => {
    const routines = await deps.getEnabledRoutines();

    for (const routine of routines) {
      // Per-routine isolation: one failing routine must not abort the tick.
      await processRoutine(routine, now).catch((error: unknown) => {
        deps.onError?.(error, routine.id);
      });
    }
  };

  return { tick };
};
