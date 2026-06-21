import { eq, desc } from "drizzle-orm";
import { annotationsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class AnnotationsDao {
  constructor(readonly executor: DbExecutor) {}

  async getAll() {
    return this.executor.select().from(annotationsTable).orderBy(desc(annotationsTable.updatedAt));
  }

  async getById(id: string) {
    const rows = await this.executor
      .select()
      .from(annotationsTable)
      .where(eq(annotationsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async getByPipelineId(pipelineId: string) {
    return this.executor
      .select()
      .from(annotationsTable)
      .where(eq(annotationsTable.pipelineId, pipelineId))
      .orderBy(desc(annotationsTable.createdAt));
  }

  async getByTargetId(targetId: string) {
    return this.executor
      .select()
      .from(annotationsTable)
      .where(eq(annotationsTable.targetId, targetId))
      .orderBy(desc(annotationsTable.createdAt));
  }

  async create(data: typeof annotationsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(annotationsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof annotationsTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(annotationsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(annotationsTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(annotationsTable).where(eq(annotationsTable.id, id));
  }
}

export const createAnnotationsDao = (executor: DbExecutor) => {
  return new AnnotationsDao(executor);
};
