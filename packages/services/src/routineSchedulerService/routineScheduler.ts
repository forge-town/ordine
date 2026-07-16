import { ResultAsync, type Result } from "neverthrow";
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
};

type CronField = ReadonlySet<number>;

const fullRange = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const withStep = (values: number[], base: number, step: number): number[] =>
  values.filter((value) => (value - base) % step === 0);

/**
 * Parses a single cron field. Supported syntax: `*`, `*​/n`, a single value
 * `5`, a range `1-5`, a stepped range `1-5/2`, and comma lists (`1,3,5`,
 * `0-2,4`) whose segments are parsed recursively and merged. Malformed or
 * out-of-range input returns null, which callers treat as "do not schedule".
 */
const parseCronField = (field: string, min: number, max: number): CronField | null => {
  // Comma list: parse each segment and merge; any invalid segment invalidates the whole field.
  if (field.includes(",")) {
    const parts = field.split(",");
    const merged = new Set<number>();
    for (const part of parts) {
      const sub = parseCronField(part, min, max);
      if (!sub) return null;
      for (const value of sub) merged.add(value);
    }

    return merged;
  }

  if (field === "*") {
    return new Set(fullRange(min, max));
  }

  // `*/n`: the full range with a step.
  const stepAllMatch = /^\*\/(\d+)$/.exec(field);
  if (stepAllMatch) {
    const step = Number(stepAllMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;

    return new Set(withStep(fullRange(min, max), min, step));
  }

  // Range `a-b` and stepped range `a-b/n`.
  const rangeMatch = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(field);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const step = rangeMatch[3] === undefined ? 1 : Number(rangeMatch[3]);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      !Number.isInteger(step) ||
      step <= 0 ||
      start < min ||
      end > max ||
      start > end
    ) {
      return null;
    }

    return new Set(withStep(fullRange(start, end), start, step));
  }

  const value = Number(field);
  if (!Number.isInteger(value) || value < min || value > max) return null;

  return new Set([value]);
};

const isAllowed = (field: CronField, value: number) => field.has(value);

const startOfNextMinute = (from: Date) => {
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  return next;
};

/**
 * Computes the next occurrence of a 5-field cron expression strictly after
 * `from`, in local time. Returns null for missing or invalid expressions.
 */
export const getNextCronRunAt = (expression: string | null, from: Date): Date | null => {
  if (!expression) return null;

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [minuteExpr, hourExpr, dayExpr, monthExpr, weekdayExpr] = parts;
  const minute = parseCronField(minuteExpr!, 0, 59);
  const hour = parseCronField(hourExpr!, 0, 23);
  const day = parseCronField(dayExpr!, 1, 31);
  const month = parseCronField(monthExpr!, 1, 12);
  const weekday = parseCronField(weekdayExpr!, 0, 6);
  if (!minute || !hour || !day || !month || !weekday) return null;

  const candidate = startOfNextMinute(from);
  const maxIterations = 366 * 24 * 60;
  for (const _ of Array.from({ length: maxIterations })) {
    if (
      isAllowed(minute, candidate.getMinutes()) &&
      isAllowed(hour, candidate.getHours()) &&
      isAllowed(day, candidate.getDate()) &&
      isAllowed(month, candidate.getMonth() + 1) &&
      isAllowed(weekday, candidate.getDay())
    ) {
      return new Date(candidate);
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  return null;
};

const toStringInputs = (inputConfig: Record<string, unknown> | null): Record<string, string> => {
  if (!inputConfig) return {};

  return Object.fromEntries(
    Object.entries(inputConfig).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value]] : [],
    ),
  );
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
 *   scheduled time): record a skipped job with a "missed while offline"
 *   reason and advance the schedule. Missed runs are never backfilled.
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

  const tick = async (now = new Date()) => {
    const routines = await deps.getEnabledRoutines();

    for (const routine of routines) {
      if (!routine.enabled) continue;

      const scheduledAt = routine.nextRunAt;
      if (!scheduledAt) {
        const upcoming = getNextCronRunAt(routine.cronExpression, now);
        if (upcoming) {
          await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
        }

        continue;
      }

      if (scheduledAt.getTime() > now.getTime()) continue;

      const upcoming = getNextCronRunAt(routine.cronExpression, now);
      const lateByMs = now.getTime() - scheduledAt.getTime();

      if (lateByMs > graceWindowMs) {
        await deps.recordSkippedJob({
          pipelineId: routine.pipelineId,
          routineId: routine.id,
          routineName: routine.name,
          reason: `Missed scheduled run at ${scheduledAt.toISOString()} while the scheduler was offline; missed runs are not backfilled`,
        });
        await deps.updateRoutine(routine.id, { nextRunAt: upcoming });

        continue;
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
        await deps.recordSkippedJob({
          pipelineId: routine.pipelineId,
          routineId: routine.id,
          routineName: routine.name,
          reason: `Failed to start scheduled run: ${describeError(startResult.error)}`,
        });
        await deps.updateRoutine(routine.id, { nextRunAt: upcoming });
      }
    }
  };

  return { tick };
};
