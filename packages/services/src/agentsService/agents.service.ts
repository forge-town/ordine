import { createAgentsDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
} from "./methods";

export const createAgentsService = (db: DbConnection) => {
  const dao = createAgentsDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    delete: createDeleteMethod(dao),
  };
};
