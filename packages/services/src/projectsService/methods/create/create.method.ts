import { ResultAsync } from "neverthrow";
import type { createProjectsDao } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createCreateMethod = (projectsDao: ReturnType<typeof createProjectsDao>) =>
  ({
    create(data: Parameters<typeof projectsDao.create>[0]) {
      return ResultAsync.fromPromise(projectsDao.create(data), (error) =>
        toServiceError(error, "Create project"),
      );
    },
  }).create;
