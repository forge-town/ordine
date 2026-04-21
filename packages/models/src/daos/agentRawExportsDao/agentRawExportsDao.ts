import { eq, desc } from "drizzle-orm";
import { agentRawExportsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export type InsertAgentRawExport = Omit<
  typeof agentRawExportsTable.$inferInsert,
  "id" | "createdAt"
>;

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

    return row;
  }

  async deleteByJobId(jobId: string) {
    await this.executor.delete(agentRawExportsTable).where(eq(agentRawExportsTable.jobId, jobId));
  }
}

export const createAgentRawExportsDao = (executor: DbExecutor) => {
  return new AgentRawExportsDao(executor);
};

export type AgentRawExportsDaoInstance = ReturnType<typeof createAgentRawExportsDao>;
