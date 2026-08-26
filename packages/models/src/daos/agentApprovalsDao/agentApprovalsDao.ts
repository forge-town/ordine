import { and, desc, eq, gt, lt } from "drizzle-orm";
import { agentApprovalsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class AgentApprovalsDao {
  constructor(readonly executor: DbExecutor) {}

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(agentApprovalsTable)
      .where(eq(agentApprovalsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findByActionId(actionId: string) {
    const rows = await this.executor
      .select()
      .from(agentApprovalsTable)
      .where(eq(agentApprovalsTable.actionId, actionId))
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByThreadId(threadId: string) {
    return this.executor
      .select()
      .from(agentApprovalsTable)
      .where(eq(agentApprovalsTable.threadId, threadId))
      .orderBy(desc(agentApprovalsTable.createdAt));
  }

  async create(data: typeof agentApprovalsTable.$inferInsert) {
    const rows = await this.executor.insert(agentApprovalsTable).values(data).returning();

    return rows[0]!;
  }

  async approve(id: string, now: Date) {
    const rows = await this.executor
      .update(agentApprovalsTable)
      .set({ status: "approved", approvedAt: now })
      .where(
        and(
          eq(agentApprovalsTable.id, id),
          eq(agentApprovalsTable.status, "pending"),
          gt(agentApprovalsTable.expiresAt, now),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async reject(id: string) {
    const rows = await this.executor
      .update(agentApprovalsTable)
      .set({ status: "rejected" })
      .where(and(eq(agentApprovalsTable.id, id), eq(agentApprovalsTable.status, "pending")))
      .returning();

    return rows[0] ?? null;
  }

  async consume(id: string, now: Date) {
    const rows = await this.executor
      .update(agentApprovalsTable)
      .set({ status: "consumed", consumedAt: now })
      .where(
        and(
          eq(agentApprovalsTable.id, id),
          eq(agentApprovalsTable.status, "approved"),
          gt(agentApprovalsTable.expiresAt, now),
        ),
      )
      .returning();

    return rows[0] ?? null;
  }

  async expirePending(now: Date) {
    return this.executor
      .update(agentApprovalsTable)
      .set({ status: "expired" })
      .where(and(eq(agentApprovalsTable.status, "pending"), lt(agentApprovalsTable.expiresAt, now)))
      .returning();
  }
}

export const createAgentApprovalsDao = (executor: DbExecutor) => new AgentApprovalsDao(executor);
