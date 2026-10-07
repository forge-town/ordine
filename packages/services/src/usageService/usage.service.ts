import { createUsageDao, type DbConnection } from "@repo/models";

import {
  createGetSummaryMethod,
  createGetDailyTokenSeriesMethod,
  createGetByPipelineMethod,
  createGetByAgentMethod,
} from "./methods";

export const createUsageService = (db: DbConnection) => {
  const dao = createUsageDao(db);

  return {
    getSummary: createGetSummaryMethod(dao),
    getDailyTokenSeries: createGetDailyTokenSeriesMethod(dao),
    getByPipeline: createGetByPipelineMethod(dao),
    getByAgent: createGetByAgentMethod(dao),
  };
};
