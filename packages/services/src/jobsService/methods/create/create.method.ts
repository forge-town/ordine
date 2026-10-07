import type { createJobsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createCreateMethod =
  (jobsDao: ReturnType<typeof createJobsDao>) =>
  async (...args: Parameters<typeof jobsDao.create>) =>
    withMeta(await jobsDao.create(...args));
