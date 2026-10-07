import type { createOperationsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createOperationsDao>) => async () =>
  mapWithMeta(await dao.findMany());
