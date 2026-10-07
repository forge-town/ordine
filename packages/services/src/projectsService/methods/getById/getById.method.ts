import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createProjectsDao } from "@repo/models";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createGetByIdMethod = (projectsDao: ReturnType<typeof createProjectsDao>) =>
  ({
    getById(id: string) {
      return ResultAsync.fromPromise(projectsDao.findById(id), (error) =>
        toServiceError(error, "Get project"),
      ).andThen((project) =>
        project ? okAsync(project) : errAsync(new NotFoundError("Project", id)),
      );
    },
  }).getById;
