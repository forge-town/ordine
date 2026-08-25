import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { agentChangeSetsTable } from "@repo/db-schema";
import type { AgentChangeSetStatus } from "@repo/schemas";
import type { DbExecutor } from "../../types";

const ACTIVE_STATUSES = ["drafting", "ready", "conflicted"] satisfies AgentChangeSetStatus[];

export class AgentChangeSetsDao {
  constructor(readonly executor: DbExecutor) {}

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(agentChangeSetsTable)
      .where(eq(agentChangeSetsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findActive(threadId: string, targetType: string, targetId: string) {
    const rows = await this.executor
      .select()
      .from(agentChangeSetsTable)
      .where(
        and(
          eq(agentChangeSetsTable.threadId, threadId),
          eq(agentChangeSetsTable.targetType, targetType),
          eq(agentChangeSetsTable.targetId, targetId),
          inArray(agentChangeSetsTable.status, ACTIVE_STATUSES),
        ),
      )
      .orderBy(desc(agentChangeSetsTable.updatedAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByThreadId(threadId: string) {
    return this.executor
      .select()
      .from(agentChangeSetsTable)
      .where(eq(agentChangeSetsTable.threadId, threadId))
      .orderBy(desc(agentChangeSetsTable.updatedAt));
  }

  async findLatestByOriginChangeSetId(originChangeSetId: string) {
    const rows = await this.executor
      .select()
      .from(agentChangeSetsTable)
      .where(eq(agentChangeSetsTable.originChangeSetId, originChangeSetId))
      .orderBy(desc(agentChangeSetsTable.updatedAt))
      .limit(1);

    return rows[0] ?? null;
  }

  async create(data: typeof agentChangeSetsTable.$inferInsert) {
    const now = new Date();
    const rows = await this.executor
      .insert(agentChangeSetsTable)
      .values({ ...data, createdAt: now, updatedAt: now })
      .returning();

    return rows[0]!;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof agentChangeSetsTable.$inferInsert, "id" | "createdAt">>,
  ) {
    const rows = await this.executor
      .update(agentChangeSetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agentChangeSetsTable.id, id))
      .returning();

    return rows[0] ?? null;
  }

  async updateDraftWithExpectedRevision(
    id: string,
    expectedRevision: number,
    draftSnapshot: NonNullable<(typeof agentChangeSetsTable.$inferInsert)["draftSnapshot"]>,
  ) {
    const rows = await this.executor
      .update(agentChangeSetsTable)
      .set({
        draftSnapshot,
        revision: sql`${agentChangeSetsTable.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentChangeSetsTable.id, id),
          eq(agentChangeSetsTable.status, "drafting"),
          eq(agentChangeSetsTable.revision, expectedRevision),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async transition(
    id: string,
    from: readonly AgentChangeSetStatus[],
    patch: Partial<Omit<typeof agentChangeSetsTable.$inferInsert, "id" | "createdAt">>,
  ) {
    const rows = await this.executor
      .update(agentChangeSetsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(agentChangeSetsTable.id, id), inArray(agentChangeSetsTable.status, [...from])))
      .returning();

    return rows[0] ?? null;
  }
}

export const createAgentChangeSetsDao = (executor: DbExecutor) => new AgentChangeSetsDao(executor);
