import { eq, desc } from "drizzle-orm";
import { operationsTable } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

class OperationsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(operationsTable).orderBy(desc(operationsTable.createdAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(operationsTable)
      .where(eq(operationsTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof operationsTable.$inferInsert) {
    const [inserted] = await this.executor.insert(operationsTable).values(data).returning();
    return inserted!;
  }

  async update(id: string, data: Partial<Omit<typeof operationsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(operationsTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationsTable.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(operationsTable).where(eq(operationsTable.id, id));
  }
}

export const createOperationsDao = (executor: DbExecutor) => {
  return new OperationsDao(executor);
};

export type OperationsDaoInstance = ReturnType<typeof createOperationsDao>;
