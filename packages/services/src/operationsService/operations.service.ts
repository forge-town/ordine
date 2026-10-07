import {
  createOperationRegistryRepository,
  createOperationsDao,
  type DbConnection,
} from "@repo/models";

import { createCapabilityCatalogService } from "../capabilityCatalogService";

import type { OperationsServiceOptions } from "./contracts";
import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
} from "./methods";
export const createOperationsService = (
  db: DbConnection,
  options: OperationsServiceOptions = {},
) => {
  const dao = createOperationsDao(db);
  const operationRegistryRepository = createOperationRegistryRepository(db);
  const capabilityCatalog =
    options.capabilityCatalog ??
    createCapabilityCatalogService(db, options.capabilityCatalogOptions);
  const create = createCreateMethod(dao, capabilityCatalog);
  const update = createUpdateMethod(dao, capabilityCatalog);
  const deleteOperation = createDeleteMethod(operationRegistryRepository);

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    create,
    update,
    delete: deleteOperation,
  };
};
