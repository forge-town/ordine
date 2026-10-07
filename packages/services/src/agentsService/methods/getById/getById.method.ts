import type { createAgentsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (dao: ReturnType<typeof createAgentsDao>) => async (id: string) =>
    withMeta(await dao.findById(id));
