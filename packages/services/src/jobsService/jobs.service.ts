import {
  createJobsDao,
  createJobTracesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  type DbConnection,
} from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateStatusMethod,
  createDeleteMethod,
  createGetTracesByJobIdMethod,
  createGetAgentRunsByJobIdMethod,
  createGetAgentRunByIdMethod,
  createGetSpansByJobIdMethod,
  createGetSpansByRawExportIdMethod,
  createExpireStaleJobsMethod,
} from "./methods";

export const createJobsService = (db: DbConnection) => {
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);

  return {
    getAll: createGetAllMethod(jobsDao),
    getById: createGetByIdMethod(jobsDao),
    create: createCreateMethod(jobsDao),
    updateStatus: createUpdateStatusMethod(jobsDao),
    delete: createDeleteMethod(jobsDao),
    getTracesByJobId: createGetTracesByJobIdMethod(jobTracesDao),
    getAgentRunsByJobId: createGetAgentRunsByJobIdMethod(agentRawExportsDao),
    getAgentRunById: createGetAgentRunByIdMethod(agentRawExportsDao),
    getSpansByJobId: createGetSpansByJobIdMethod(agentSpansDao),
    getSpansByRawExportId: createGetSpansByRawExportIdMethod(agentSpansDao),
    expireStaleJobs: createExpireStaleJobsMethod(jobsDao),
  };
};
