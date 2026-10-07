import type { createOperationsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createOperationsDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
