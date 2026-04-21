import {
  createJobsDao,
  createJobTracesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  type DbConnection,
} from "@repo/models";

export const createJobsService = (db: DbConnection) => {
  const dao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);

  return {
    getAll: (...args: Parameters<typeof dao.findMany>) => dao.findMany(...args),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    updateStatus: (...args: Parameters<typeof dao.updateStatus>) => dao.updateStatus(...args),
    delete: (id: string) => dao.delete(id),
    getTracesByJobId: (jobId: string) => jobTracesDao.findByJobId(jobId),
    getAgentRunsByJobId: (jobId: string) => agentRawExportsDao.findByJobId(jobId),
    getAgentRunById: (id: number) => agentRawExportsDao.findById(id),
    getSpansByJobId: (jobId: string) => agentSpansDao.findByJobId(jobId),
    getSpansByRawExportId: (rawExportId: number) => agentSpansDao.findByRawExportId(rawExportId),
    expireStaleJobs: (defaultTimeoutMs: number) => dao.expireStaleJobs(defaultTimeoutMs),
  };
};
