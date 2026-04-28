import { desc, eq } from "drizzle-orm";
import { refinementRunsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class RefinementRunsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByJobId(jobId: string) {
    const rows = await this.executor
      .select()
      .from(refinementRunsTable)
      .where(eq(refinementRunsTable.id, jobId))
      .limit(1);

    return rows[0];
  }

  async findByRefinementId(refinementId: string) {
    return this.executor
      .select()
      .from(refinementRunsTable)
      .where(eq(refinementRunsTable.refinementId, refinementId))
      .orderBy(desc(refinementRunsTable.createdAt));
  }

  async create(data: typeof refinementRunsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(refinementRunsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(jobId: string, patch: Partial<Omit<typeof refinementRunsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(refinementRunsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(refinementRunsTable.id, jobId))
      .returning();

    return updated;
  }

  async delete(jobId: string) {
    await this.executor.delete(refinementRunsTable).where(eq(refinementRunsTable.id, jobId));
  }
}

export const createRefinementRunsDao = (executor: DbExecutor) => {
  return new RefinementRunsDao(executor);
};
