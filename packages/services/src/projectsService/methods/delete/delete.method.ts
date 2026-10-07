import { isForeignKeyViolation } from "../../helpers/isForeignKeyViolation";
import { ResultAsync, errAsync } from "neverthrow";
import type { createPipelinesDao, createProjectsDao } from "@repo/models";
import {
  ConflictError,
  type NotFoundError,
  toServiceError,
  type ServiceError,
} from "../../../serviceErrors";

import type { createGetByIdMethod } from "../getById";

export const createDeleteMethod = (
  projectsDao: ReturnType<typeof createProjectsDao>,
  pipelinesDao: ReturnType<typeof createPipelinesDao>,
) =>
  ({
    delete(id: string): ResultAsync<void, NotFoundError | ConflictError | ServiceError> {
      return (this as unknown as { getById: ReturnType<typeof createGetByIdMethod> })
        .getById(id)
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
            isForeignKeyViolation(error)
              ? new ConflictError(`Project "${id}" still has pipelines`)
              : toServiceError(error, "Delete project"),
          );
        });
    },
  }).delete;
