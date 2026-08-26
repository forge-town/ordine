import { and, desc, eq, notLike } from "drizzle-orm";
import { pipelineAgentSessionsTable } from "@repo/db-schema";
import type { AgentContextEnvelope, PipelineAgentEntrypoint } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export class AgentThreadsDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .where(
        and(
          eq(pipelineAgentSessionsTable.entrypoint, "global-agent-bar"),
          notLike(pipelineAgentSessionsTable.id, "agent-control-%-local-owner"),
        ),
      )
      .orderBy(desc(pipelineAgentSessionsTable.updatedAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .where(
        and(
          eq(pipelineAgentSessionsTable.id, id),
          eq(pipelineAgentSessionsTable.entrypoint, "global-agent-bar"),
          notLike(pipelineAgentSessionsTable.id, "agent-control-%-local-owner"),
        ),
      )
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

  async ensure(data: {
    id: string;
    title: string;
    entrypoint: Extract<PipelineAgentEntrypoint, "global-agent-bar" | "agent-control-external">;
    activeContext?: AgentContextEnvelope | null;
  }) {
    const now = new Date();
    await this.executor
      .insert(pipelineAgentSessionsTable)
      .values({
        ...data,
        actor: "local-owner",
        threadStatus: "active",
        mode: "edit",
        status: "draft",
        pipelineId: data.activeContext?.pipelineId ?? null,
        snapshot: null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: pipelineAgentSessionsTable.id });

    const rows = await this.executor
      .select()
      .from(pipelineAgentSessionsTable)
      .where(
        and(
          eq(pipelineAgentSessionsTable.id, data.id),
          eq(pipelineAgentSessionsTable.entrypoint, data.entrypoint),
        ),
      )
      .limit(1);

    const existing = rows[0] ?? null;
    if (existing) return existing;
    const legacyExternalId =
      data.entrypoint === "agent-control-external" &&
      /^agent-control-(?:internal-run|public-readwrite|public-readonly|stdio)-local-owner$/.test(
        data.id,
      );
    if (!legacyExternalId) return null;
    const migrated = await this.executor
      .update(pipelineAgentSessionsTable)
      .set({ entrypoint: "agent-control-external", updatedAt: now })
      .where(
        and(
          eq(pipelineAgentSessionsTable.id, data.id),
          eq(pipelineAgentSessionsTable.entrypoint, "global-agent-bar"),
        ),
      )
      .returning();

    return migrated[0] ?? null;
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
      .where(
        and(
          eq(pipelineAgentSessionsTable.id, id),
          eq(pipelineAgentSessionsTable.entrypoint, "global-agent-bar"),
          notLike(pipelineAgentSessionsTable.id, "agent-control-%-local-owner"),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }
}

export const createAgentThreadsDao = (executor: DbExecutor) => new AgentThreadsDao(executor);
