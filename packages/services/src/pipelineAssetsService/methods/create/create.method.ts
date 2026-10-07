import { ResultAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { toServiceError } from "../../../serviceErrors";

export const createCreateMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) =>
  (data: Parameters<typeof assetsDao.create>[0]) =>
    ResultAsync.fromPromise(assetsDao.create(data), (error) =>
      toServiceError(error, "Create pipeline asset"),
    );
