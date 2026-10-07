import type { createAgentRuntimesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createAgentRuntimesDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
