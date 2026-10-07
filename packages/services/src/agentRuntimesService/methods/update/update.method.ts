import type { createAgentRuntimesDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createUpdateMethod =
  (dao: ReturnType<typeof createAgentRuntimesDao>) =>
  async (id: string, patch: Parameters<typeof dao.update>[1]) =>
    withMeta(await dao.update(id, patch));
