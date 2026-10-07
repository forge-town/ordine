import type { createAgentRuntimesDao } from "@repo/models";

export const createDeleteMethod =
  (dao: ReturnType<typeof createAgentRuntimesDao>) => (id: string) =>
    dao.delete(id);
