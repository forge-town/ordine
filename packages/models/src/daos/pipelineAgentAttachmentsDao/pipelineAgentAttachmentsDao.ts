import { asc, eq } from "drizzle-orm";
import { pipelineAgentAttachmentsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAgentAttachmentsDao {
  constructor(readonly executor: DbExecutor) {}

  async create(data: typeof pipelineAgentAttachmentsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineAgentAttachmentsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async findManyBySessionId(sessionId: string) {
    return this.executor
      .select()
      .from(pipelineAgentAttachmentsTable)
      .where(eq(pipelineAgentAttachmentsTable.sessionId, sessionId))
      .orderBy(asc(pipelineAgentAttachmentsTable.createdAt));
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof pipelineAgentAttachmentsTable.$inferInsert, "id">>,
  ) {
    const [updated] = await this.executor
      .update(pipelineAgentAttachmentsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineAgentAttachmentsTable.id, id))
      .returning();

    return updated;
  }
}

export const createPipelineAgentAttachmentsDao = (executor: DbExecutor) =>
  new PipelineAgentAttachmentsDao(executor);
