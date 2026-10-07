import type { createOperationOutputItemTemplatesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createOperationOutputItemTemplatesDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
