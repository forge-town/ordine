import type { createJobsDao } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGetByIdMethod =
  (jobsDao: ReturnType<typeof createJobsDao>) => async (id: string) =>
    withMeta(await jobsDao.findById(id));
