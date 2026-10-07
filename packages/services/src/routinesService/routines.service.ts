import { createRoutinesDao, type DbConnection } from "@repo/models";

import type { RoutineStartRun } from "../routineSchedulerService/contracts";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createGetByPipelineIdMethod,
  createGetEnabledMethod,
  createGetOccurrencesMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
  createRunNowMethod,
} from "./methods";

export const createRoutinesService = (
  db: DbConnection,
  deps: {
    startRun: RoutineStartRun;
  },
) => {
  const dao = createRoutinesDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    getByPipelineId: createGetByPipelineIdMethod(dao),
    getEnabled: createGetEnabledMethod(dao),
    getOccurrences: createGetOccurrencesMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    delete: createDeleteMethod(dao),
    runNow: createRunNowMethod(dao, deps),
  };
};
