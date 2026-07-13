import { desc, eq, sql } from "drizzle-orm";
import { pipelineAssetsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAssetsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(pipelineAssetsTable)
      .orderBy(desc(pipelineAssetsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAssetsTable)
      .where(eq(pipelineAssetsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async findManyByPipelineId(pipelineId: string) {
    return this.executor
      .select()
      .from(pipelineAssetsTable)
      .where(eq(pipelineAssetsTable.pipelineId, pipelineId))
      .orderBy(desc(pipelineAssetsTable.updatedAt));
  }

  async create(data: typeof pipelineAssetsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineAssetsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof pipelineAssetsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(pipelineAssetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineAssetsTable.id, id))
      .returning();

    return updated;
  }

  async incrementRunStats(id: string, stats: { success: boolean; durationMs: number }) {
    const successValue = stats.success ? 1 : 0;
    const [updated] = await this.executor
      .update(pipelineAssetsTable)
      .set({
        totalRuns: sql<number>`${pipelineAssetsTable.totalRuns} + 1`,
        successRate: sql<string>`(
          coalesce(${pipelineAssetsTable.successRate}, 0)::numeric
          * ${pipelineAssetsTable.totalRuns}
          + ${successValue}
        ) / (${pipelineAssetsTable.totalRuns} + 1)`,
        avgDurationMs: sql<number>`round((
          coalesce(${pipelineAssetsTable.avgDurationMs}, 0)::numeric
          * ${pipelineAssetsTable.totalRuns}
          + ${stats.durationMs}
        ) / (${pipelineAssetsTable.totalRuns} + 1))::integer`,
        updatedAt: new Date(),
      })
      .where(eq(pipelineAssetsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(pipelineAssetsTable).where(eq(pipelineAssetsTable.id, id));
  }
}

export const createPipelineAssetsDao = (executor: DbExecutor) => new PipelineAssetsDao(executor);
