import { desc, eq } from "drizzle-orm";
import { pipelineRunsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineRunsDao {
  constructor(readonly executor: DbExecutor) {}

  async findByJobId(jobId: string) {
    const rows = await this.executor
      .select()
      .from(pipelineRunsTable)
      .where(eq(pipelineRunsTable.id, jobId))
      .limit(1);

    return rows[0];
  }

  async findByPipelineId(pipelineId: string) {
    return this.executor
      .select()
      .from(pipelineRunsTable)
      .where(eq(pipelineRunsTable.pipelineId, pipelineId))
      .orderBy(desc(pipelineRunsTable.createdAt));
  }

  async create(data: typeof pipelineRunsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineRunsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(jobId: string, patch: Partial<Omit<typeof pipelineRunsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(pipelineRunsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineRunsTable.id, jobId))
      .returning();

    return updated;
  }

  async delete(jobId: string) {
    await this.executor.delete(pipelineRunsTable).where(eq(pipelineRunsTable.id, jobId));
  }
}

export const createPipelineRunsDao = (executor: DbExecutor) => {
  return new PipelineRunsDao(executor);
};
