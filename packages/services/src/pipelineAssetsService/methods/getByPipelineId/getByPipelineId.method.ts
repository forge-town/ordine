import { ResultAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { toServiceError } from "../../../serviceErrors";

export const createGetByPipelineIdMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) => (pipelineId: string) =>
    ResultAsync.fromPromise(assetsDao.findManyByPipelineId(pipelineId), (error) =>
      toServiceError(error, "Get pipeline assets by pipeline"),
    );
