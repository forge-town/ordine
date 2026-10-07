import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createUpdateMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) =>
  (id: string, patch: Parameters<typeof assetsDao.update>[1]) =>
    ResultAsync.fromPromise(assetsDao.update(id, patch), (error) =>
      toServiceError(error, "Update pipeline asset"),
    ).andThen((asset) =>
      asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", id)),
    );
