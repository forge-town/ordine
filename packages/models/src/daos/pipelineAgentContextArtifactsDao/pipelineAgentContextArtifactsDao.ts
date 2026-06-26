import { asc, eq } from "drizzle-orm";
import { pipelineAgentContextArtifactsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAgentContextArtifactsDao {
  constructor(readonly executor: DbExecutor) {}

  async create(data: typeof pipelineAgentContextArtifactsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineAgentContextArtifactsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();
    return inserted!;
  }

  async findManyBySessionId(sessionId: string) {
    return this.executor
      .select()
      .from(pipelineAgentContextArtifactsTable)
      .where(eq(pipelineAgentContextArtifactsTable.sessionId, sessionId))
      .orderBy(asc(pipelineAgentContextArtifactsTable.createdAt));
  }
}

export const createPipelineAgentContextArtifactsDao = (executor: DbExecutor) =>
  new PipelineAgentContextArtifactsDao(executor);
