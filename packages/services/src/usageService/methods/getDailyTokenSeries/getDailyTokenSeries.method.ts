import { toNumber } from "../../helpers/toNumber";

import { ResultAsync } from "neverthrow";
import type { createUsageDao, UsageDateRange } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetDailyTokenSeriesMethod = (dao: ReturnType<typeof createUsageDao>) =>
  function getDailyTokenSeries(range: UsageDateRange) {
    return ResultAsync.fromPromise(dao.getDailyTokenSeries(range), (error) =>
      toServiceError(error, "Get daily usage series"),
    ).map((rows) =>
      rows.map((row) => ({
        date: row.date,
        tokens: toNumber(row.tokens),
      })),
    );
  };
