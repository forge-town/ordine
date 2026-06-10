import type { Result } from "neverthrow";
import type { JobTriggeredBy, Routine } from "@repo/schemas";

type SchedulerRoutine = Pick<
  Routine,
  | "cronExpression"
  | "enabled"
  | "id"
  | "inputConfig"
  | "lastRunAt"
  | "nextRunAt"
  | "pipelineId"
  | "triggerType"
>;

type RoutinePatch = {
  lastRunAt?: Date | null;
  nextRunAt?: Date | null;
};

export type RoutineSchedulerDeps = {
  getEnabledRoutines: () => Promise<SchedulerRoutine[]>;
  startRun: (opts: {
    inputs?: Record<string, string>;
    pipelineId: string;
    triggeredBy: JobTriggeredBy;
  }) => Promise<Result<{ jobId: string }, unknown>>;
  updateRoutine: (id: string, patch: RoutinePatch) => Promise<unknown>;
};

type CronField = ReadonlySet<number>;

const parseCronField = (field: string, min: number, max: number): CronField | null => {
  if (field === "*") {
    return new Set(Array.from({ length: max - min + 1 }, (_, index) => min + index));
  }

  const stepMatch = /^\*\/(\d+)$/.exec(field);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;

    return new Set(
      Array.from({ length: max - min + 1 }, (_, index) => min + index).filter(
        (value) => (value - min) % step === 0,
      ),
    );
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
  for (let index = 0; index < maxIterations; index += 1) {
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

export const createRoutineScheduler = (deps: RoutineSchedulerDeps) => {
  const tick = async (now = new Date()) => {
    const routines = await deps.getEnabledRoutines();

    for (const routine of routines) {
      if (!routine.enabled || routine.triggerType !== "cron") continue;

      const scheduledAt = routine.nextRunAt ?? getNextCronRunAt(routine.cronExpression, now);
      if (!scheduledAt) continue;

      if (!routine.nextRunAt || scheduledAt.getTime() > now.getTime()) {
        await deps.updateRoutine(routine.id, { nextRunAt: scheduledAt });

        continue;
      }

      await deps.startRun({
        inputs: toStringInputs(routine.inputConfig),
        pipelineId: routine.pipelineId,
        triggeredBy: "routine",
      });
      await deps.updateRoutine(routine.id, {
        lastRunAt: now,
        nextRunAt: getNextCronRunAt(routine.cronExpression, now),
      });
    }
  };

  return { tick };
};
