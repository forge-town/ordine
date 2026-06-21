import { ResultAsync } from "neverthrow";
import { createUsageDao, type DbConnection, type UsageDateRange } from "@repo/models";
import type { AgentRuntime } from "@repo/schemas";
import { toServiceError } from "../serviceErrors";

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
      ).map((summary) => {
        const totalCost = toNumber(summary.totalCost);
        const runCount = toNumber(summary.runCount);

        return {
          totalTokens: toNumber(summary.totalTokens),
          totalCost,
          runCount,
          avgCostPerRun: runCount > 0 ? totalCost / runCount : 0,
        };
      });
    },

    getDailyCostSeries(range: UsageDateRange) {
      return ResultAsync.fromPromise(dao.getDailyCostSeries(range), (error) =>
        toServiceError(error, "Get daily usage series"),
      ).map((rows) =>
        rows.map((row) => ({
          date: row.date,
          cost: toNumber(row.cost),
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
          totalCost: toNumber(row.totalCost),
          runCount: toNumber(row.runCount),
        })),
      );
    },

    getByAgent(range: UsageDateRange) {
      return ResultAsync.fromPromise(dao.getByAgent(range), (error) =>
        toServiceError(error, "Get usage by agent"),
      ).map((rows) =>
        rows.map((row) => ({
          agentRuntime: row.agentRuntime as AgentRuntime,
          agentId: row.agentId,
          modelId: row.modelId,
          tokens: toNumber(row.tokens),
          runCount: toNumber(row.runCount),
        })),
      );
    },
  };
};
