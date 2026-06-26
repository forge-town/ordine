import { eq } from "drizzle-orm";
import { pipelineAgentSessionsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAgentSessionsDao {
  constructor(readonly executor: DbExecutor) {}

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .where(eq(pipelineAgentSessionsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async create(data: typeof pipelineAgentSessionsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineAgentSessionsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof pipelineAgentSessionsTable.$inferInsert, "id">>,
  ) {
    const [updated] = await this.executor
      .update(pipelineAgentSessionsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineAgentSessionsTable.id, id))
      .returning();

    return updated;
  }
}

export const createPipelineAgentSessionsDao = (executor: DbExecutor) =>
  new PipelineAgentSessionsDao(executor);
