import { eq, desc } from "drizzle-orm";
import { agentSpansTable, type SpanType, type SpanStatus } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export interface InsertAgentSpan {
  jobId: string;
  rawExportId?: number | null;
  parentSpanId?: number | null;
  spanType: SpanType;
  name: string;
  input?: string | null;
  output?: string | null;
  modelId?: string | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  durationMs?: number | null;
  status?: SpanStatus;
  error?: string | null;
  metadata?: unknown;
  startedAt?: Date;
  finishedAt?: Date | null;
}

class AgentSpansDao {
  constructor(readonly executor: DbExecutor) {}

  async insert(data: InsertAgentSpan) {
    const [inserted] = await this.executor.insert(agentSpansTable).values(data).returning();
    return inserted!;
  }

  async insertMany(data: InsertAgentSpan[]) {
    if (data.length === 0) return [];
    return this.executor.insert(agentSpansTable).values(data).returning();
  }

  async findByJobId(jobId: string) {
    return this.executor
      .select()
      .from(agentSpansTable)
      .where(eq(agentSpansTable.jobId, jobId))
      .orderBy(desc(agentSpansTable.startedAt));
  }

  async findByRawExportId(rawExportId: number) {
    return this.executor
      .select()
      .from(agentSpansTable)
      .where(eq(agentSpansTable.rawExportId, rawExportId))
      .orderBy(desc(agentSpansTable.startedAt));
  }

  async updateStatus(
    id: number,
    status: SpanStatus,
    finishedAt: Date,
    durationMs?: number,
    error?: string,
  ) {
    const [updated] = await this.executor
      .update(agentSpansTable)
      .set({ status, finishedAt, durationMs, error })
      .where(eq(agentSpansTable.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(agentSpansTable).where(eq(agentSpansTable.jobId, jobId));
  }
}

export const createAgentSpansDao = (executor: DbExecutor) => {
  return new AgentSpansDao(executor);
};

export type AgentSpansDaoInstance = ReturnType<typeof createAgentSpansDao>;
