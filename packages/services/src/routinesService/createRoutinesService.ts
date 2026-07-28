import { err, ok, type Result } from "neverthrow";
import { createRoutinesDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";
import { getNextCronRunAt, toStringInputs } from "@repo/utils";
import type { RoutineStartRun } from "../routineSchedulerService/routineScheduler";

// Disabled routines never have a pending occurrence; enabled routines get the
// next occurrence of their cron expression (null when the expression is
// missing or invalid, which the scheduler treats as "do not schedule").
const resolveNextRunAt = (enabled: boolean, cronExpression: string | null): Date | null =>
  enabled ? getNextCronRunAt(cronExpression, new Date()) : null;

// Shared invariant for create and update: an enabled routine must have a
// computable next occurrence; a disabled routine never has one.
const resolveSchedule = (
  enabled: boolean,
  cronExpression: string | null,
): Result<Date | null, Error> => {
  const nextRunAt = resolveNextRunAt(enabled, cronExpression);
  if (enabled && !nextRunAt) {
    return err(new Error("An enabled routine requires a valid cronExpression"));
  }

  return ok(nextRunAt);
};

export const createRoutinesService = (
  db: DbConnection,
  deps: {
    startRun: RoutineStartRun;
  },
) => {
  const dao = createRoutinesDao(db);

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByPipelineId: async (pipelineId: string) =>
      mapWithMeta(await dao.findManyByPipelineId(pipelineId)),
    getEnabled: async () => mapWithMeta(await dao.findManyEnabled()),
    create: async (data: Parameters<typeof dao.create>[0]) => {
      const schedule = resolveSchedule(data.enabled ?? true, data.cronExpression ?? null);
      if (schedule.isErr()) return err(schedule.error);

      return ok(withMeta(await dao.create({ ...data, nextRunAt: schedule.value })));
    },
    update: async (id: string, patch: Parameters<typeof dao.update>[1]) => {
      const existing = await dao.findById(id);
      if (!existing) return err(new Error(`Routine not found: ${id}`));

      // The enabled/cron cross-check lives here (not in UpdateRoutineSchema)
      // because it needs the stored routine: a pure { enabled: true } patch is
      // legal when the stored cron expression is already valid.
      const enabled = patch.enabled ?? existing.enabled;
      const cronExpression =
        patch.cronExpression === undefined ? existing.cronExpression : patch.cronExpression;
      const schedule = resolveSchedule(enabled, cronExpression);
      if (schedule.isErr()) return err(schedule.error);

      // Recompute the schedule only when the patch touches it; disabling a
      // routine clears nextRunAt.
      const scheduleTouched = patch.enabled !== undefined || patch.cronExpression !== undefined;
      const effectivePatch = scheduleTouched ? { ...patch, nextRunAt: schedule.value } : patch;

      const updated = await dao.update(id, effectivePatch);
      if (!updated) return err(new Error(`Routine not found: ${id}`));

      return ok(withMeta(updated));
    },
    delete: (id: string) => dao.delete(id),
    runNow: async (id: string): Promise<Result<{ jobId: string }, Error>> => {
      const routine = await dao.findById(id);
      if (!routine) return err(new Error(`Routine not found: ${id}`));

      const result = await deps.startRun({
        inputs: toStringInputs(routine.inputConfig),
        pipelineId: routine.pipelineId,
        triggeredBy: "routine",
      });
      if (result.isOk()) {
        // Run now does not touch the cron schedule; it only marks the routine
        // as having run.
        await dao.update(id, { lastRunAt: new Date() });
      }

      return result;
    },
  };
};
