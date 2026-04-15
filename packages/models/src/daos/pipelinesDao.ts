import { eq, desc } from "drizzle-orm";
import { pipelinesTable, type PipelineRow } from "@repo/db-schema";
import type { DbExecutor } from "../types.js";

export type PipelineEntity = PipelineRow & {
  nodeCount: number;
};

const rowToEntity = (row: PipelineRow): PipelineEntity => ({
  ...row,
  nodeCount: row.nodes.length,
});

class PipelinesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    const rows = await this.executor
      .select()
      .from(pipelinesTable)
      .orderBy(desc(pipelinesTable.updatedAt));
    return rows.map(rowToEntity);
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelinesTable)
      .where(eq(pipelinesTable.id, id))
      .limit(1);
    return rows[0] ? rowToEntity(rows[0]!) : null;
  }

  async create(data: typeof pipelinesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelinesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return rowToEntity(inserted!);
  }

  async update(id: string, patch: Partial<Omit<typeof pipelinesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(pipelinesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelinesTable.id, id))
      .returning();
    return updated ? rowToEntity(updated) : null;
  }

  async delete(id: string) {
    await this.executor.delete(pipelinesTable).where(eq(pipelinesTable.id, id));
  }
}

export const createPipelinesDao = (executor: DbExecutor) => {
  return new PipelinesDao(executor);
};

export type PipelinesDaoInstance = ReturnType<typeof createPipelinesDao>;
