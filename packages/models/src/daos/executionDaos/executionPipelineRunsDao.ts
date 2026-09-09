import { eq } from "drizzle-orm";
import { executionPipelineRunsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionPipelineRunsDao = (executor: DbExecutor) => ({
  async setOutputs(jobId: string, outputs: NonNullable<typeof table.$inferSelect.outputs>) {
    const rows = await executor
      .update(table)
      .set({ outputs })
      .where(eq(table.jobId, jobId))
      .returning();

    return rows[0] ?? null;
  },
  async findByJobId(jobId: string) {
    const rows = await executor.select().from(table).where(eq(table.jobId, jobId)).limit(1);

    return rows[0] ?? null;
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
