import type { createJobTracesDao } from "@repo/models";

export const createGetTracesByJobIdMethod =
  (jobTracesDao: ReturnType<typeof createJobTracesDao>) => (jobId: string) =>
    jobTracesDao.findByJobId(jobId);
