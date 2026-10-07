import type { createAgentsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (dao: ReturnType<typeof createAgentsDao>) =>
  async (...args: Parameters<typeof dao.create>) =>
    withMeta(await dao.create(...args));
