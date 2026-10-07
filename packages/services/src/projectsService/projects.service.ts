import { createPipelinesDao, createProjectsDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
} from "./methods";

export const createProjectsService = (db: DbConnection) => {
  const projectsDao = createProjectsDao(db);
  const pipelinesDao = createPipelinesDao(db);

  return {
    getAll: createGetAllMethod(projectsDao),
    getById: createGetByIdMethod(projectsDao),
    create: createCreateMethod(projectsDao),
    update: createUpdateMethod(projectsDao),
    delete: createDeleteMethod(projectsDao, pipelinesDao),
  };
};
