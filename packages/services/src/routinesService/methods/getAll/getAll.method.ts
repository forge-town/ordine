import type { createRoutinesDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createRoutinesDao>) => async () =>
  mapWithMeta(await dao.findMany());
