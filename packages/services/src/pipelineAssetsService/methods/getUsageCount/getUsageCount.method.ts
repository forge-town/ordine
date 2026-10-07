import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createPipelineAssetsDao, createPipelinesDao } from "@repo/models";

import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createGetUsageCountMethod =
  (
    assetsDao: ReturnType<typeof createPipelineAssetsDao>,
    pipelinesDao: ReturnType<typeof createPipelinesDao>,
  ) =>
  (id: string) =>
    ResultAsync.fromPromise(assetsDao.findById(id), (error) =>
      toServiceError(error, "Get pipeline asset usage target"),
    )
      .andThen((asset) =>
        asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
      )
      .andThen((asset) =>
        ResultAsync.fromPromise(pipelinesDao.findById(asset.pipelineId), (error) =>
          toServiceError(error, "Get pipeline asset usage"),
        ).map((pipeline) => ({
          assetId: id,
          count: pipeline ? 1 : 0,
        })),
      );
