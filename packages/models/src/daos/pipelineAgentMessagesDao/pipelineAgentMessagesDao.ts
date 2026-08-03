import { asc, eq } from "drizzle-orm";
import { pipelineAgentMessagesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAgentMessagesDao {
  constructor(readonly executor: DbExecutor) {}

  async create(data: typeof pipelineAgentMessagesTable.$inferInsert) {
    const [inserted] = await this.executor.insert(pipelineAgentMessagesTable).values(data).returning();

    return inserted!;
  }

  async findManyBySessionId(sessionId: string) {
    return this.executor
      .select()
      .from(pipelineAgentMessagesTable)
      .where(eq(pipelineAgentMessagesTable.sessionId, sessionId))
      .orderBy(asc(pipelineAgentMessagesTable.createdAt));
  }
}

export const createPipelineAgentMessagesDao = (executor: DbExecutor) =>
  new PipelineAgentMessagesDao(executor);
