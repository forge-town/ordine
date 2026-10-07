import type { createJobsDao } from "@repo/models";

export const createDeleteMethod = (jobsDao: ReturnType<typeof createJobsDao>) => (id: string) =>
  jobsDao.delete(id);
