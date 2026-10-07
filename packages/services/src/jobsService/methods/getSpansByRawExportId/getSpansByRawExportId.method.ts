import type { createAgentSpansDao } from "@repo/models";

export const createGetSpansByRawExportIdMethod =
  (agentSpansDao: ReturnType<typeof createAgentSpansDao>) => (rawExportId: number) =>
    agentSpansDao.findByRawExportId(rawExportId);
