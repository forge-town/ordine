import { createJobsDao, createJobTracesDao, type DbConnection } from "@repo/models";

export const createJobsService = (db: DbConnection) => {
  const dao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);

  return {
    getAll: (...args: Parameters<typeof dao.findMany>) => dao.findMany(...args),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    updateStatus: (...args: Parameters<typeof dao.updateStatus>) => dao.updateStatus(...args),
    delete: (id: string) => dao.delete(id),
    getTracesByJobId: (jobId: string) => jobTracesDao.findByJobId(jobId),
  };
};
