import { desc, eq } from "drizzle-orm";
import { distillationsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class DistillationsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(distillationsTable).orderBy(desc(distillationsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(distillationsTable)
      .where(eq(distillationsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof distillationsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(distillationsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof distillationsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(distillationsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(distillationsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(distillationsTable).where(eq(distillationsTable.id, id));
  }
}

export const createDistillationsDao = (executor: DbExecutor) => {
  return new DistillationsDao(executor);
};
