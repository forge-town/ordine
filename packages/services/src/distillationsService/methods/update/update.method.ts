import type { createDistillationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeDistillationRecord } from "../../helpers/normalizers/normalizers.helper";

export const createUpdateMethod =
  (distillationsDao: ReturnType<typeof createDistillationsDao>) =>
  async (...args: Parameters<typeof distillationsDao.update>) => {
    const record = await distillationsDao.update(...args);

    return withMeta(record ? normalizeDistillationRecord(record) : undefined);
  };
