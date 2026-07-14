import { and, desc, gte, isNotNull, lte, sql } from "drizzle-orm";
import { agentRawExportsTable, jobsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export type UsageDateRange = Readonly<{
  from: Date;
  to: Date;
}>;

export class UsageDao {
  constructor(readonly executor: DbExecutor) {}

  async getSummary({ from, to }: UsageDateRange) {
    const rows = await this.executor
      .select({
        totalTokens: sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)::double precision`,
        runCount: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .where(
        and(
          gte(jobsTable.createdAt, from),
          lte(jobsTable.createdAt, to),
          isNotNull(jobsTable.totalTokens),
        ),
      );

    return rows[0]!;
  }

  async getDailyTokenSeries({ from, to }: UsageDateRange) {
    const day = sql`date_trunc('day', ${jobsTable.createdAt})`;

    return this.executor
      .select({
        date: sql<string>`to_char(${day}, 'YYYY-MM-DD')`,
        tokens: sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)::double precision`,
      })
      .from(jobsTable)
      .where(
        and(
          gte(jobsTable.createdAt, from),
          lte(jobsTable.createdAt, to),
          isNotNull(jobsTable.totalTokens),
        ),
      )
      .groupBy(day)
      .orderBy(day);
  }

  async getByPipeline({ from, to }: UsageDateRange) {
    const totalTokens = sql<number>`coalesce(sum(coalesce(${jobsTable.totalTokens}, 0)), 0)::double precision`;

    return this.executor
      .select({
        pipelineId: jobsTable.pipelineId,
        totalTokens,
        runCount: sql<number>`count(*)::int`,
      })
      .from(jobsTable)
      .where(
        and(
          gte(jobsTable.createdAt, from),
          lte(jobsTable.createdAt, to),
          isNotNull(jobsTable.totalTokens),
        ),
      )
      .groupBy(jobsTable.pipelineId)
      .orderBy(desc(totalTokens));
  }

  async getByAgent({ from, to }: UsageDateRange) {
    const tokens = sql<number>`coalesce(sum(
      coalesce(${agentRawExportsTable.tokenInput}, 0)
      + coalesce(${agentRawExportsTable.tokenOutput}, 0)
    ), 0)::double precision`;

    return this.executor
      .select({
        agentRuntime: agentRawExportsTable.agentRuntime,
        agentId: agentRawExportsTable.agentId,
        modelId: agentRawExportsTable.modelId,
        tokens,
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
      .orderBy(desc(tokens));
  }
}

export const createUsageDao = (executor: DbExecutor) => new UsageDao(executor);
