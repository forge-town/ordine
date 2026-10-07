import { toNumber } from "../../helpers/toNumber";

import { ResultAsync } from "neverthrow";
import type { createUsageDao, UsageDateRange } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetSummaryMethod = (dao: ReturnType<typeof createUsageDao>) =>
  function getSummary(range: UsageDateRange) {
    return ResultAsync.fromPromise(dao.getSummary(range), (error) =>
      toServiceError(error, "Get usage summary"),
    ).map((summary) => ({
      totalTokens: toNumber(summary.totalTokens),
      runCount: toNumber(summary.runCount),
    }));
  };
