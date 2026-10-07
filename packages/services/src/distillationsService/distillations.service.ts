import {
  createAgentRawExportsDao,
  createAgentSpansDao,
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
  createRunMethod,
} from "./methods";

export const createDistillationsService = (db: DbConnection) => {
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: createGetAllMethod(distillationsDao),
    getById: createGetByIdMethod(distillationsDao),
    create: createCreateMethod(distillationsDao),
    update: createUpdateMethod(distillationsDao),
    delete: createDeleteMethod(distillationsDao),
    run: createRunMethod(
      distillationsDao,
      jobsDao,
      jobTracesDao,
      agentRawExportsDao,
      agentSpansDao,
      pipelinesDao,
      settingsDao,
    ),
  };
};
