import type { createDistillationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeDistillationRecord } from "../../helpers/normalizers/normalizers.helper";

export const createGetByIdMethod =
  (distillationsDao: ReturnType<typeof createDistillationsDao>) => async (id: string) => {
    const record = await distillationsDao.findById(id);

    if (!record) {
      return undefined;
    }

    return withMeta(normalizeDistillationRecord(record));
  };
