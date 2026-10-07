import type { createOperationOutputItemTemplatesDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod =
  (dao: ReturnType<typeof createOperationOutputItemTemplatesDao>) => async () =>
    mapWithMeta(await dao.findMany());
