import { createAgentRuntimesDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
  createSyncAllMethod,
} from "./methods";

export const createAgentRuntimesService = (db: DbConnection) => {
  const dao = createAgentRuntimesDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    delete: createDeleteMethod(dao),
    syncAll: createSyncAllMethod(dao),
  };
};
