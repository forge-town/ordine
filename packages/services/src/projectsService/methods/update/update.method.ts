import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createProjectsDao } from "@repo/models";
import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createUpdateMethod = (projectsDao: ReturnType<typeof createProjectsDao>) =>
  ({
    update(id: string, patch: Parameters<typeof projectsDao.update>[1]) {
      return ResultAsync.fromPromise(projectsDao.update(id, patch), (error) =>
        toServiceError(error, "Update project"),
      ).andThen((project) =>
        project ? okAsync(project) : errAsync(new NotFoundError("Project", id)),
      );
    },
  }).update;
