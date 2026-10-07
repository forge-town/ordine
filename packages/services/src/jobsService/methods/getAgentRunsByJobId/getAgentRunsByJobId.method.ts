import type { createAgentRawExportsDao } from "@repo/models";

export const createGetAgentRunsByJobIdMethod =
  (agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>) => (jobId: string) =>
    agentRawExportsDao.findByJobId(jobId);
