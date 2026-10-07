import type { createAgentsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createAgentsDao>) => async () =>
  mapWithMeta(await dao.findMany());
