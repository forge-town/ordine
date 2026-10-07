import {
  createDistillationsDao,
  createJobsDao,
  createPipelinesDao,
  createRefinementsDao,
  type DbConnection,
} from "@repo/models";

import { createPipelinesService } from "../pipelinesService";
import {
  createPipelineRunnerService,
  type PipelineRunnerServiceOptions,
} from "../pipelineRunnerService";
import { createDistillationsService } from "../distillationsService";
import {
  createGetAllMethod,
  createGetByIdMethod,
  createDeleteMethod,
  createStartMethod,
} from "./methods";
import { createUpdateRoundHelper, createRunLoopHelper } from "./helpers";
export const createRefinementsService = (
  db: DbConnection,
  options: PipelineRunnerServiceOptions = {},
) => {
  const dao = createRefinementsDao(db);

  const jobsDao = createJobsDao(db);

  const distillationsDao = createDistillationsDao(db);

  const pipelinesDao = createPipelinesDao(db);

  const pipelinesService = createPipelinesService(db);

  const pipelineRunnerService = createPipelineRunnerService(db, options);

  const distillationsService = createDistillationsService(db);
  const updateRound = createUpdateRoundHelper(dao);
  const runLoop = createRunLoopHelper(
    dao,
    jobsDao,
    distillationsDao,
    pipelinesDao,
    pipelinesService,
    pipelineRunnerService,
    distillationsService,
    updateRound,
  );

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    delete: createDeleteMethod(dao),
    start: createStartMethod(dao, distillationsDao, runLoop),
  };
};
