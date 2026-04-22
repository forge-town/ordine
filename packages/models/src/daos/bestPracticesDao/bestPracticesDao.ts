import { eq, desc } from "drizzle-orm";
import { bestPracticesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class BestPracticesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(bestPracticesTable)
      .orderBy(desc(bestPracticesTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(bestPracticesTable)
      .where(eq(bestPracticesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof bestPracticesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(bestPracticesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof bestPracticesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(bestPracticesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(bestPracticesTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(bestPracticesTable).where(eq(bestPracticesTable.id, id));
  }
}

export const createBestPracticesDao = (executor: DbExecutor) => {
  return new BestPracticesDao(executor);
};
