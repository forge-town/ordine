import { toNumber } from "../../helpers/toNumber";

import { ResultAsync } from "neverthrow";
import type { createUsageDao, UsageDateRange } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetByPipelineMethod = (dao: ReturnType<typeof createUsageDao>) =>
  function getByPipeline(range: UsageDateRange) {
    return ResultAsync.fromPromise(dao.getByPipeline(range), (error) =>
      toServiceError(error, "Get usage by pipeline"),
    ).map((rows) =>
      rows.map((row) => ({
        pipelineId: row.pipelineId,
        totalTokens: toNumber(row.totalTokens),
        runCount: toNumber(row.runCount),
      })),
    );
  };
