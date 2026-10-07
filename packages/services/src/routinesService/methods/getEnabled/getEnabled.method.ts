import type { createRoutinesDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetEnabledMethod = (dao: ReturnType<typeof createRoutinesDao>) => async () =>
  mapWithMeta(await dao.findManyEnabled());
