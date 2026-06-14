import { sql, and, gte, lte, desc } from "drizzle-orm";
import { agentRawExportsTable, jobsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export interface UsageDateRange {
  from: Date;
  to: Date;
}

export class UsageDao {
  constructor(readonly executor: DbExecutor) {}

  async getSummary({ from, to }: UsageDateRange) {
    const rows = await this.executor
      .select({
        totalTokens: sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)`,
        totalCost: sql<string>`coalesce(sum(coalesce(${jobsTable.totalCost}, 0)), 0)`,
        runCount: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .where(and(gte(jobsTable.createdAt, from), lte(jobsTable.createdAt, to)));

    return rows[0]!;
  }

  async getDailyCostSeries({ from, to }: UsageDateRange) {
    return this.executor
      .select({
        date: sql<string>`to_char(date_trunc('day', ${jobsTable.createdAt}), 'YYYY-MM-DD')`,
        cost: sql<string>`coalesce(sum(coalesce(${jobsTable.totalCost}, 0)), 0)`,
        tokens: sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)`,
      })
      .from(jobsTable)
      .where(and(gte(jobsTable.createdAt, from), lte(jobsTable.createdAt, to)))
      .groupBy(sql`date_trunc('day', ${jobsTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${jobsTable.createdAt})`);
  }

  async getByPipeline({ from, to }: UsageDateRange) {
    return this.executor
      .select({
        pipelineId: jobsTable.pipelineId,
        totalTokens: sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)`,
        totalCost: sql<string>`coalesce(sum(coalesce(${jobsTable.totalCost}, 0)), 0)`,
        runCount: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .where(and(gte(jobsTable.createdAt, from), lte(jobsTable.createdAt, to)))
      .groupBy(jobsTable.pipelineId)
      .orderBy(desc(sql`sum(coalesce(${jobsTable.totalCost}, 0))`));
  }

  async getByAgent({ from, to }: UsageDateRange) {
    return this.executor
      .select({
        agentRuntime: agentRawExportsTable.agentRuntime,
        agentId: agentRawExportsTable.agentId,
        modelId: agentRawExportsTable.modelId,
        tokens: sql<number>`coalesce(sum(coalesce(${agentRawExportsTable.tokenInput}, 0) + coalesce(${agentRawExportsTable.tokenOutput}, 0)), 0)`,
        runCount: sql<number>`count(*)::int`,
      })
      .from(agentRawExportsTable)
      .where(
        and(gte(agentRawExportsTable.createdAt, from), lte(agentRawExportsTable.createdAt, to)),
      )
      .groupBy(
        agentRawExportsTable.agentRuntime,
        agentRawExportsTable.agentId,
        agentRawExportsTable.modelId,
      )
      .orderBy(
        desc(
          sql`sum(coalesce(${agentRawExportsTable.tokenInput}, 0) + coalesce(${agentRawExportsTable.tokenOutput}, 0))`,
        ),
      );
  }
}

export const createUsageDao = (executor: DbExecutor) => {
  return new UsageDao(executor);
};
