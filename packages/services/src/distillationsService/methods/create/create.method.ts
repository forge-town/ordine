import type { createDistillationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeDistillationRecord } from "../../helpers/normalizers/normalizers.helper";

export const createCreateMethod =
  (distillationsDao: ReturnType<typeof createDistillationsDao>) =>
  async (...args: Parameters<typeof distillationsDao.create>) =>
    withMeta(normalizeDistillationRecord(await distillationsDao.create(...args)));
