import {
  createJobsDao,
  createJobTracesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  type DbConnection,
} from "@repo/models";

export const createJobsService = (db: DbConnection) => {
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);

  return {
    getAll: (...args: Parameters<typeof jobsDao.findMany>) => jobsDao.findMany(...args),
    getById: (id: string) => jobsDao.findById(id),
    create: (...args: Parameters<typeof jobsDao.create>) => jobsDao.create(...args),
    updateStatus: (...args: Parameters<typeof jobsDao.updateStatus>) =>
      jobsDao.updateStatus(...args),
    delete: (id: string) => jobsDao.delete(id),
    getTracesByJobId: (jobId: string) => jobTracesDao.findByJobId(jobId),
    getAgentRunsByJobId: (jobId: string) => agentRawExportsDao.findByJobId(jobId),
    getAgentRunById: (id: number) => agentRawExportsDao.findById(id),
    getSpansByJobId: (jobId: string) => agentSpansDao.findByJobId(jobId),
    getSpansByRawExportId: (rawExportId: number) => agentSpansDao.findByRawExportId(rawExportId),
    expireStaleJobs: (defaultTimeoutMs: number) => jobsDao.expireStaleJobs(defaultTimeoutMs),
  };
};
