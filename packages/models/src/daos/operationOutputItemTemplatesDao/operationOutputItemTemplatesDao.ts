import { eq, desc } from "drizzle-orm";
import { operationOutputItemTemplatesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class OperationOutputItemTemplatesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(operationOutputItemTemplatesTable).orderBy(desc(operationOutputItemTemplatesTable.createdAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(operationOutputItemTemplatesTable)
      .where(eq(operationOutputItemTemplatesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof operationOutputItemTemplatesTable.$inferInsert) {
    const [inserted] = await this.executor.insert(operationOutputItemTemplatesTable).values(data).returning();

    return inserted!;
  }

  async update(id: string, data: Partial<Omit<typeof operationOutputItemTemplatesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(operationOutputItemTemplatesTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(operationOutputItemTemplatesTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(operationOutputItemTemplatesTable).where(eq(operationOutputItemTemplatesTable.id, id));
  }
}

export const createOperationOutputItemTemplatesDao = (executor: DbExecutor) => {
  return new OperationOutputItemTemplatesDao(executor);
};
