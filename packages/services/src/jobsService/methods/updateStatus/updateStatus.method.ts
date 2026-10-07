import type { createJobsDao } from "@repo/models";

export const createUpdateStatusMethod =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  (...args: Parameters<typeof jobsDao.updateStatus>) =>
    jobsDao.updateStatus(...args);
