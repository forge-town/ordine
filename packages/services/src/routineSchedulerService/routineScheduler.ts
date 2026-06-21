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

const fullRange = (min: number, max: number): number[] =>
  Array.from({ length: max - min + 1 }, (_, index) => min + index);

const withStep = (values: number[], base: number, step: number): number[] =>
  values.filter((value) => (value - base) % step === 0);

/**
 * 解析单个 cron 字段。支持：
 *   `*` / `*​/n` / 单值 `5` / 区间 `1-5` / 区间步进 `1-5/2` / `*​/n`，
 *   以及逗号列表 `1,3,5`、`0-2,4`（各段递归解析后取并集）。
 * 非法语法/越界 → null（上层据此判定"不调度"）。
 * （内置「Weekday 09:00」预设生成 `0 9 * * 1-5`，旧实现 Number("1-5")=NaN 静默失效——N21-02 修。）
 */
const parseCronField = (field: string, min: number, max: number): CronField | null => {
  // 逗号列表：逐段解析并求并集，任一段非法即整体非法。
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

  // `*​/n`：整段范围按步进。
  const stepAllMatch = /^\*\/(\d+)$/.exec(field);
  if (stepAllMatch) {
    const step = Number(stepAllMatch[1]);
    if (!Number.isInteger(step) || step <= 0) return null;

    return new Set(withStep(fullRange(min, max), min, step));
  }

  // 区间 `a-b` 及区间步进 `a-b/n`。
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
