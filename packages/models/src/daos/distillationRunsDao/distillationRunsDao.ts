import { desc, eq } from "drizzle-orm";
import { distillationRunsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class DistillationRunsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByJobId(jobId: string) {
    const rows = await this.executor
      .select()
      .from(distillationRunsTable)
      .where(eq(distillationRunsTable.id, jobId))
      .limit(1);

    return rows[0];
  }

  async findByDistillationId(distillationId: string) {
    return this.executor
      .select()
      .from(distillationRunsTable)
      .where(eq(distillationRunsTable.distillationId, distillationId))
      .orderBy(desc(distillationRunsTable.createdAt));
  }

  async create(data: typeof distillationRunsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(distillationRunsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(
    jobId: string,
    patch: Partial<Omit<typeof distillationRunsTable.$inferInsert, "id">>,
  ) {
    const [updated] = await this.executor
      .update(distillationRunsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(distillationRunsTable.id, jobId))
      .returning();

    return updated;
  }

  async delete(jobId: string) {
    await this.executor.delete(distillationRunsTable).where(eq(distillationRunsTable.id, jobId));
  }
}

export const createDistillationRunsDao = (executor: DbExecutor) => {
  return new DistillationRunsDao(executor);
};
