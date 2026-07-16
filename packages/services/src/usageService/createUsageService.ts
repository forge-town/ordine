import { ResultAsync } from "neverthrow";
import { createUsageDao, type DbConnection, type UsageDateRange } from "@repo/models";
import { toServiceError } from "../serviceErrors";

// Product decision: cost was cut across the whole product — usage is reported
// in tokens only (no totalCost/avgCostPerRun/daily cost series).
const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value === null || value === undefined) return 0;

  return Number(value);
};

export const createUsageService = (db: DbConnection) => {
  const dao = createUsageDao(db);

  return {
    getSummary(range: UsageDateRange) {
      return ResultAsync.fromPromise(dao.getSummary(range), (error) =>
        toServiceError(error, "Get usage summary"),
      ).map((summary) => ({
        totalTokens: toNumber(summary.totalTokens),
        runCount: toNumber(summary.runCount),
      }));
    },

    getDailyTokenSeries(range: UsageDateRange) {
      return ResultAsync.fromPromise(dao.getDailyTokenSeries(range), (error) =>
        toServiceError(error, "Get daily usage series"),
      ).map((rows) =>
        rows.map((row) => ({
          date: row.date,
          tokens: toNumber(row.tokens),
        })),
      );
    },

    getByPipeline(range: UsageDateRange) {
      return ResultAsync.fromPromise(dao.getByPipeline(range), (error) =>
        toServiceError(error, "Get usage by pipeline"),
      ).map((rows) =>
        rows.map((row) => ({
          pipelineId: row.pipelineId,
          totalTokens: toNumber(row.totalTokens),
          runCount: toNumber(row.runCount),
        })),
      );
    },

    getByAgent(range: UsageDateRange) {
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
    },
  };
};
