import { eq, desc } from "drizzle-orm";
import { agentRawExportsTable, type AgentSystem, type AgentRunStatus } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export interface InsertAgentRawExport {
  jobId: string;
  agentSystem: AgentSystem;
  agentId: string;
  modelId?: string | null;
  rawPayload: unknown;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  durationMs?: number | null;
  status?: AgentRunStatus;
}

class AgentRawExportsDao {
  constructor(readonly executor: DbExecutor) {}

  async insert(data: InsertAgentRawExport) {
    const [inserted] = await this.executor.insert(agentRawExportsTable).values(data).returning();
    return inserted!;
  }

  async findByJobId(jobId: string) {
    return this.executor
      .select()
      .from(agentRawExportsTable)
      .where(eq(agentRawExportsTable.jobId, jobId))
      .orderBy(desc(agentRawExportsTable.createdAt));
  }

  async findById(id: number) {
    const [row] = await this.executor
      .select()
      .from(agentRawExportsTable)
      .where(eq(agentRawExportsTable.id, id))
      .limit(1);
    return row ?? null;
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(agentRawExportsTable).where(eq(agentRawExportsTable.jobId, jobId));
  }
}

export const createAgentRawExportsDao = (executor: DbExecutor) => {
  return new AgentRawExportsDao(executor);
};

export type AgentRawExportsDaoInstance = ReturnType<typeof createAgentRawExportsDao>;
