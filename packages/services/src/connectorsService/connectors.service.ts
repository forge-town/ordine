import { createConnectorsDao, type DbConnection } from "@repo/models";

import type { ConnectorsServiceOptions } from "./contracts";
import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createConnectMethod,
  createDeleteMethod,
} from "./methods";
export const createConnectorsService = (
  db: DbConnection,
  options: ConnectorsServiceOptions = {},
) => {
  const dao = createConnectorsDao(db);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    connect: createConnectMethod(dao, options),
    delete: createDeleteMethod(dao),
  };
};
