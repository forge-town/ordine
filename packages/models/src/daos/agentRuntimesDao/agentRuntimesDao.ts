import { eq, desc } from "drizzle-orm";
import { agentRuntimesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class AgentRuntimesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(agentRuntimesTable)
      .orderBy(desc(agentRuntimesTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(agentRuntimesTable)
      .where(eq(agentRuntimesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof agentRuntimesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(agentRuntimesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof agentRuntimesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(agentRuntimesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agentRuntimesTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(agentRuntimesTable).where(eq(agentRuntimesTable.id, id));
  }
}

export const createAgentRuntimesDao = (executor: DbExecutor) => {
  return new AgentRuntimesDao(executor);
};
