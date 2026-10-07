import type { Result } from "neverthrow";
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
  jobId?: string;
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
  claimNextRun: (id: string, scheduledAt: Date, nextRunAt: Date | null) => Promise<boolean>;
  startRun: RoutineStartRun;
  updateRoutine: (id: string, patch: RoutinePatch) => Promise<unknown>;
  recordSkippedJob: (input: SkippedJobInput) => Promise<unknown>;
  /** Invoked when processing a single routine throws; the tick continues. */
  onError?: (error: unknown, routineId: string) => void;
};
