import { desc, eq } from "drizzle-orm";
import { refinementsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class RefinementsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(refinementsTable).orderBy(desc(refinementsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(refinementsTable)
      .where(eq(refinementsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof refinementsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(refinementsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof refinementsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(refinementsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(refinementsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(refinementsTable).where(eq(refinementsTable.id, id));
  }
}

export const createRefinementsDao = (executor: DbExecutor) => {
  return new RefinementsDao(executor);
};
