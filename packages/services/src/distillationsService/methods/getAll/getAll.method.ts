import type { createDistillationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";
import { normalizeDistillationRecord } from "../../helpers/normalizers/normalizers.helper";

export const createGetAllMethod =
  (distillationsDao: ReturnType<typeof createDistillationsDao>) => async () => {
    const records = await distillationsDao.findMany();

    return records.map((record) => withMeta(normalizeDistillationRecord(record)));
  };
