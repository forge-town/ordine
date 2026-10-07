import { resolveSchedule } from "../../helpers/resolveSchedule";
import { err, ok } from "neverthrow";
import type { createRoutinesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (dao: ReturnType<typeof createRoutinesDao>) => async (data: Parameters<typeof dao.create>[0]) => {
    const schedule = resolveSchedule(data.enabled ?? true, data.cronExpression ?? null);
    if (schedule.isErr()) return err(schedule.error);

    return ok(withMeta(await dao.create({ ...data, nextRunAt: schedule.value })));
  };
