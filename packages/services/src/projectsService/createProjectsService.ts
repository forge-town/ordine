import { ResultAsync, errAsync, okAsync } from "neverthrow";
import { createPipelinesDao, createProjectsDao, type DbConnection } from "@repo/models";
import { ConflictError, NotFoundError, toServiceError, type ServiceError } from "../serviceErrors";

export const createProjectsService = (db: DbConnection) => {
  const projectsDao = createProjectsDao(db);
  const pipelinesDao = createPipelinesDao(db);

  return {
    getAll() {
      return ResultAsync.fromPromise(projectsDao.getAll(), (error) =>
        toServiceError(error, "Get projects"),
      );
    },

    getById(id: string) {
      return ResultAsync.fromPromise(projectsDao.getById(id), (error) =>
        toServiceError(error, "Get project"),
      ).andThen((project) =>
        project ? okAsync(project) : errAsync(new NotFoundError("Project", id)),
      );
    },

    create(data: Parameters<typeof projectsDao.create>[0]) {
      return ResultAsync.fromPromise(projectsDao.create(data), (error) =>
        toServiceError(error, "Create project"),
      );
    },

    update(id: string, patch: Parameters<typeof projectsDao.update>[1]) {
      return ResultAsync.fromPromise(projectsDao.update(id, patch), (error) =>
        toServiceError(error, "Update project"),
      ).andThen((project) =>
        project ? okAsync(project) : errAsync(new NotFoundError("Project", id)),
      );
    },

    delete(id: string): ResultAsync<void, NotFoundError | ConflictError | ServiceError> {
      return this.getById(id)
        .andThen(() =>
          ResultAsync.fromPromise(pipelinesDao.findMany(), (error) =>
            toServiceError(error, "List pipelines for project delete"),
          ),
        )
        .andThen((pipelines) => {
          if (pipelines.some((pipeline) => pipeline.projectId === id)) {
            return errAsync(new ConflictError(`Project "${id}" still has pipelines`));
          }

          return ResultAsync.fromPromise(projectsDao.delete(id), (error) =>
            toServiceError(error, "Delete project"),
          );
        });
    },
  };
};
