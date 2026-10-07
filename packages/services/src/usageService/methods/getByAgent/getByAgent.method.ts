import { toNumber } from "../../helpers/toNumber";

import { ResultAsync } from "neverthrow";
import type { createUsageDao, UsageDateRange } from "@repo/models";
import { toServiceError } from "../../../serviceErrors";

export const createGetByAgentMethod = (dao: ReturnType<typeof createUsageDao>) =>
  function getByAgent(range: UsageDateRange) {
    return ResultAsync.fromPromise(dao.getByAgent(range), (error) =>
      toServiceError(error, "Get usage by agent"),
    ).map((rows) =>
      rows.map((row) => ({
        agentRuntime: row.agentRuntime,
        agentId: row.agentId,
        modelId: row.modelId,
        tokens: toNumber(row.tokens),
        runCount: toNumber(row.runCount),
      })),
    );
  };
