import type { createAgentRuntimesDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod = (dao: ReturnType<typeof createAgentRuntimesDao>) => async () =>
  mapWithMeta(await dao.findMany());
