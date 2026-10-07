import type { createJobsDao } from "@repo/models";

export const createExpireStaleJobsMethod =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  (...args: Parameters<typeof jobsDao.expireStaleJobs>) =>
    jobsDao.expireStaleJobs(...args);
