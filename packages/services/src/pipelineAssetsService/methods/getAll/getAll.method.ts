import { ResultAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { toServiceError } from "../../../serviceErrors";

export const createGetAllMethod = (assetsDao: ReturnType<typeof createPipelineAssetsDao>) => () =>
  ResultAsync.fromPromise(assetsDao.findMany(), (error) =>
    toServiceError(error, "Get pipeline assets"),
  );
