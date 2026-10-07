import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createGetByIdMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) => (id: string) =>
    ResultAsync.fromPromise(assetsDao.findById(id), (error) =>
      toServiceError(error, "Get pipeline asset"),
    ).andThen((asset) =>
      asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
    );
