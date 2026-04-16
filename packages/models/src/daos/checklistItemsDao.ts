import { eq, asc } from "drizzle-orm";
import { checklistItemsTable } from "@repo/db-schema";
import type { DbExecutor } from "../types";

class ChecklistItemsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByBestPracticeId(bestPracticeId: string) {
    return this.executor
      .select()
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.bestPracticeId, bestPracticeId))
      .orderBy(asc(checklistItemsTable.sortOrder));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(checklistItemsTable)
      .where(eq(checklistItemsTable.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof checklistItemsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(checklistItemsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return inserted!;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof checklistItemsTable.$inferInsert, "id" | "bestPracticeId">>,
  ) {
    const [updated] = await this.executor
      .update(checklistItemsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(checklistItemsTable.id, id))
      .returning();
    return updated ?? null;
  }

  async delete(id: string) {
    await this.executor.delete(checklistItemsTable).where(eq(checklistItemsTable.id, id));
  }

  async deleteByBestPracticeId(bestPracticeId: string) {
    await this.executor
      .delete(checklistItemsTable)
      .where(eq(checklistItemsTable.bestPracticeId, bestPracticeId));
  }
}

export const createChecklistItemsDao = (executor: DbExecutor) => {
  return new ChecklistItemsDao(executor);
};

export type ChecklistItemsDaoInstance = ReturnType<typeof createChecklistItemsDao>;
