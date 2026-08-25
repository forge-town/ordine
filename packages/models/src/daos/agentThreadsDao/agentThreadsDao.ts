import { desc, eq } from "drizzle-orm";
import { pipelineAgentSessionsTable } from "@repo/db-schema";
import type { AgentContextEnvelope } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export class AgentThreadsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .orderBy(desc(pipelineAgentSessionsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .where(eq(pipelineAgentSessionsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(data: { id: string; title: string; activeContext?: AgentContextEnvelope | null }) {
    const now = new Date();
    const rows = await this.executor
      .insert(pipelineAgentSessionsTable)
      .values({
        ...data,
        actor: "local-owner",
        threadStatus: "active",
        entrypoint: "global-agent-bar",
        mode: "edit",
        status: "draft",
        pipelineId: data.activeContext?.pipelineId ?? null,
        snapshot: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return rows[0]!;
  }

  async ensure(data: { id: string; title: string; activeContext?: AgentContextEnvelope | null }) {
    const now = new Date();
    await this.executor
      .insert(pipelineAgentSessionsTable)
      .values({
        ...data,
        actor: "local-owner",
        threadStatus: "active",
        entrypoint: "global-agent-bar",
        mode: "edit",
        status: "draft",
        pipelineId: data.activeContext?.pipelineId ?? null,
        snapshot: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: pipelineAgentSessionsTable.id });

    return this.findById(data.id);
  }

  async update(
    id: string,
    patch: Pick<
      Partial<typeof pipelineAgentSessionsTable.$inferInsert>,
      "title" | "threadStatus" | "activeContext" | "pipelineId"
    >,
  ) {
    const rows = await this.executor
      .update(pipelineAgentSessionsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(pipelineAgentSessionsTable.id, id))
      .returning();

    return rows[0] ?? null;
  }
}

export const createAgentThreadsDao = (executor: DbExecutor) => new AgentThreadsDao(executor);
