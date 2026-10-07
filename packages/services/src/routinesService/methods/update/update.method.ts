import { resolveSchedule } from "../../helpers/resolveSchedule";
import { err, ok } from "neverthrow";
import type { createRoutinesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

import { NotFoundError } from "../../../serviceErrors";

export const createUpdateMethod =
  (dao: ReturnType<typeof createRoutinesDao>) =>
  async (id: string, patch: Parameters<typeof dao.update>[1]) => {
    const existing = await dao.findById(id);
    if (!existing) return err(new NotFoundError("Routine", id));

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
    if (!updated) return err(new NotFoundError("Routine", id));

    return ok(withMeta(updated));
  };
