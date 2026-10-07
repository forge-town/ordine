import { createOperationOutputItemTemplatesDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
} from "./methods";

export const createOperationOutputItemTemplatesService = (db: DbConnection) => {
  const dao = createOperationOutputItemTemplatesDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    delete: createDeleteMethod(dao),
  };
};
