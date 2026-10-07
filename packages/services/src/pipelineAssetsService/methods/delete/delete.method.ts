import { ResultAsync } from "neverthrow";
import type { createPipelineAssetsDao } from "@repo/models";

import { toServiceError } from "../../../serviceErrors";

export const createDeleteMethod =
  (assetsDao: ReturnType<typeof createPipelineAssetsDao>) => (id: string) =>
    ResultAsync.fromPromise(assetsDao.delete(id), (error) =>
      toServiceError(error, "Delete pipeline asset"),
    );
