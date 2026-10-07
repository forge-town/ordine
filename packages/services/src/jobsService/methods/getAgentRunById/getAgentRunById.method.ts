import type { createAgentRawExportsDao } from "@repo/models";

export const createGetAgentRunByIdMethod =
  (agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>) => (id: number) =>
    agentRawExportsDao.findById(id);
