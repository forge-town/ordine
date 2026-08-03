import { asc, desc, eq } from "drizzle-orm";
import { pipelineAgentProposalsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class PipelineAgentProposalsDao {
  constructor(readonly executor: DbExecutor) {}

  async create(data: typeof pipelineAgentProposalsTable.$inferInsert) {
    const now = new Date();
    const [inserted] = await this.executor
      .insert(pipelineAgentProposalsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return inserted!;
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAgentProposalsTable)
      .where(eq(pipelineAgentProposalsTable.id, id))
      .limit(1);

    return rows[0];
  }

  async findLatestBySessionId(sessionId: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAgentProposalsTable)
      .where(eq(pipelineAgentProposalsTable.sessionId, sessionId))
      .orderBy(desc(pipelineAgentProposalsTable.createdAt))
      .limit(1);

    return rows[0];
  }

  async findManyBySessionId(sessionId: string) {
    return this.executor
      .select()
      .from(pipelineAgentProposalsTable)
      .where(eq(pipelineAgentProposalsTable.sessionId, sessionId))
      .orderBy(asc(pipelineAgentProposalsTable.createdAt));
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof pipelineAgentProposalsTable.$inferInsert, "id">>,
  ) {
    const [updated] = await this.executor
      .update(pipelineAgentProposalsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineAgentProposalsTable.id, id))
      .returning();

    return updated;
  }
}

export const createPipelineAgentProposalsDao = (executor: DbExecutor) =>
  new PipelineAgentProposalsDao(executor);
