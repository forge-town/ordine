import type { createAgentRuntimesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (dao: ReturnType<typeof createAgentRuntimesDao>) =>
  async (data: Parameters<typeof dao.create>[0]) =>
    withMeta(await dao.create(data));
