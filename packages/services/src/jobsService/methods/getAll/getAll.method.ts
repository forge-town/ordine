import type { createJobsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

export const createGetAllMethod =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  async (...args: Parameters<typeof jobsDao.findMany>) =>
    mapWithMeta(await jobsDao.findMany(...args));
