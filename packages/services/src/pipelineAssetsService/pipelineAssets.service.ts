import { createPipelineAssetsDao, createPipelinesDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createGetByPipelineIdMethod,
  createGetUsageCountMethod,
  createCreateMethod,
  createUpdateMethod,
  createIncrementRunStatsMethod,
  createDistillFromPipelineMethod,
  createDeleteMethod,
} from "./methods";

export const createPipelineAssetsService = (db: DbConnection) => {
  const assetsDao = createPipelineAssetsDao(db);
  const pipelinesDao = createPipelinesDao(db);

  return {
    getAll: createGetAllMethod(assetsDao),
    getById: createGetByIdMethod(assetsDao),
    getByPipelineId: createGetByPipelineIdMethod(assetsDao),
    getUsageCount: createGetUsageCountMethod(assetsDao, pipelinesDao),
    create: createCreateMethod(assetsDao),
    update: createUpdateMethod(assetsDao),
    incrementRunStats: createIncrementRunStatsMethod(assetsDao),
    distillFromPipeline: createDistillFromPipelineMethod(assetsDao, pipelinesDao),
    delete: createDeleteMethod(assetsDao),
  };
};
