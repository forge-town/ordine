import { and, eq } from "drizzle-orm";
import { executionArtifactsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionArtifactsDao = (executor: DbExecutor) => ({
  async updateMetadata(
    artifactId: string,
    jobId: string,
    metadata: typeof table.$inferSelect.metadata,
  ) {
    const rows = await executor
      .update(table)
      .set({ metadata, state: metadata.state })
      .where(and(eq(table.artifactId, artifactId), eq(table.jobId, jobId)))
      .returning();

    return rows[0] ?? null;
  },
  async findById(artifactId: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(eq(table.artifactId, artifactId))
      .limit(1);

    return rows[0] ?? null;
  },
  async listByJob(jobId: string) {
    return executor.select().from(table).where(eq(table.jobId, jobId));
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
