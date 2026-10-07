import { ResultAsync } from "neverthrow";
import type { createProjectsDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetAllMethod = (projectsDao: ReturnType<typeof createProjectsDao>) =>
  ({
    getAll() {
      return ResultAsync.fromPromise(projectsDao.findMany(), (error) =>
        toServiceError(error, "Get projects"),
      );
    },
  }).getAll;
