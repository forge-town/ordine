import type { createAgentSpansDao } from "@repo/models";

export const createGetSpansByJobIdMethod =
  (agentSpansDao: ReturnType<typeof createAgentSpansDao>) => (jobId: string) =>
    agentSpansDao.findByJobId(jobId);
