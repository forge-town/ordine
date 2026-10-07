import { ResultAsync, errAsync, okAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { NotFoundError, toServiceError } from "../../../serviceErrors";

export const createIncrementRunStatsMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) =>
  (...args: Parameters<typeof assetsDao.incrementRunStats>) =>
    ResultAsync.fromPromise(assetsDao.incrementRunStats(...args), (error) =>
      toServiceError(error, "Increment pipeline asset run stats"),
    ).andThen((asset) =>
      asset ? okAsync(asset) : errAsync(new NotFoundError("PipelineAsset", args[0])),
    );
