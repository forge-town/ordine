import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { agentRunsTable } from "@repo/db-schema";
import type { AgentRunStatus } from "@repo/schemas";
import type { DbExecutor } from "../../types";

const UNFINISHED_STATUSES = ["queued", "running", "cancelling"] satisfies AgentRunStatus[];

export const createAgentRunsDao = (executor: DbExecutor) => ({
  async create(data: typeof agentRunsTable.$inferInsert) {
    const rows = await executor.insert(agentRunsTable).values(data).returning();

    return rows[0]!;
  },

  async findById(id: string) {
    const rows = await executor
      .select()
      .from(agentRunsTable)
      .where(eq(agentRunsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findManyUnfinished() {
    return executor
      .select()
      .from(agentRunsTable)
      .where(inArray(agentRunsTable.status, UNFINISHED_STATUSES));
  },

  async findManyRecoverable(now: Date) {
    return executor
      .select()
      .from(agentRunsTable)
      .where(
        and(
          inArray(agentRunsTable.status, UNFINISHED_STATUSES),
          or(isNull(agentRunsTable.leaseExpiresAt), lt(agentRunsTable.leaseExpiresAt, now)),
        ),
      );
  },

  async findLatestByOwner(ownerType: string, ownerId: string) {
    const rows = await executor
      .select()
      .from(agentRunsTable)
      .where(and(eq(agentRunsTable.ownerType, ownerType), eq(agentRunsTable.ownerId, ownerId)))
      .orderBy(desc(agentRunsTable.createdAt))
      .limit(1);

    return rows[0] ?? null;
  },

  async update(
    id: string,
    patch: Partial<Omit<typeof agentRunsTable.$inferInsert, "id" | "createdAt">>,
  ) {
    const rows = await executor
      .update(agentRunsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(agentRunsTable.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async transition(
    id: string,
    from: readonly AgentRunStatus[],
    patch: Partial<Omit<typeof agentRunsTable.$inferInsert, "id" | "createdAt">>,
  ) {
    const rows = await executor
      .update(agentRunsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(agentRunsTable.id, id), inArray(agentRunsTable.status, [...from])))
      .returning();

    return rows[0] ?? null;
  },

  async claimExecutor(id: string, executorId: string, now: Date, leaseExpiresAt: Date) {
    const rows = await executor
      .update(agentRunsTable)
      .set({ executorId, heartbeatAt: now, leaseExpiresAt, updatedAt: now })
      .where(
        and(
          eq(agentRunsTable.id, id),
          eq(agentRunsTable.status, "queued"),
          isNull(agentRunsTable.executorId),
        ),
      )
      .returning();

    return rows[0] ?? null;
  },

  async refreshLease(id: string, executorId: string, now: Date, leaseExpiresAt: Date) {
    const rows = await executor
      .update(agentRunsTable)
      .set({ heartbeatAt: now, leaseExpiresAt, updatedAt: now })
      .where(
        and(
          eq(agentRunsTable.id, id),
          eq(agentRunsTable.executorId, executorId),
          inArray(agentRunsTable.status, UNFINISHED_STATUSES),
        ),
      )
      .returning({ cancelRequestedAt: agentRunsTable.cancelRequestedAt });

    return rows[0] ?? null;
  },

  async requestCancel(id: string, now: Date) {
    const rows = await executor
      .update(agentRunsTable)
      .set({ status: "cancelling", cancelRequestedAt: now, updatedAt: now })
      .where(and(eq(agentRunsTable.id, id), inArray(agentRunsTable.status, UNFINISHED_STATUSES)))
      .returning();

    return rows[0] ?? null;
  },

  async deleteExpired(before: Date) {
    return executor
      .delete(agentRunsTable)
      .where(lt(agentRunsTable.expiresAt, before))
      .returning({ id: agentRunsTable.id });
  },
});
