import { asc, desc, eq } from "drizzle-orm";
import { routinesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class RoutinesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor.select().from(routinesTable).orderBy(desc(routinesTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(routinesTable)
      .where(eq(routinesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async findManyByPipelineId(pipelineId: string) {
    return this.executor
      .select()
      .from(routinesTable)
      .where(eq(routinesTable.pipelineId, pipelineId))
      .orderBy(desc(routinesTable.updatedAt));
  }

  async findManyEnabled() {
    return this.executor
      .select()
      .from(routinesTable)
      .where(eq(routinesTable.enabled, true))
      .orderBy(asc(routinesTable.nextRunAt));
  }

  async create(data: typeof routinesTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(routinesTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(id: string, patch: Partial<Omit<typeof routinesTable.$inferInsert, "id">>) {
    const [updated] = await this.executor
      .update(routinesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(routinesTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor.delete(routinesTable).where(eq(routinesTable.id, id));
  }
}

export const createRoutinesDao = (executor: DbExecutor) => new RoutinesDao(executor);
