import { eq, desc } from "drizzle-orm";
import { agentsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class AgentsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(agentsTable)
      .orderBy(desc(agentsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof agentsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(agentsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof agentsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(agentsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agentsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(agentsTable).where(eq(agentsTable.id, id));
  }
}

export const createAgentsDao = (executor: DbExecutor) => {
  return new AgentsDao(executor);
};
