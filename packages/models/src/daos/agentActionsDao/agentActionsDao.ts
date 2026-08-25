import { and, asc, desc, eq } from "drizzle-orm";
import { agentActionsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class AgentActionsDao {
  constructor(readonly executor: DbExecutor) {}

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(agentActionsTable)
      .where(eq(agentActionsTable.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async findByIdempotency(threadId: string, toolName: string, idempotencyKey: string) {
    const rows = await this.executor
      .select()
      .from(agentActionsTable)
      .where(
        and(
          eq(agentActionsTable.threadId, threadId),
          eq(agentActionsTable.toolName, toolName),
          eq(agentActionsTable.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  }

  async findManyByChangeSetId(changeSetId: string) {
    return this.executor
      .select()
      .from(agentActionsTable)
      .where(eq(agentActionsTable.changeSetId, changeSetId))
      .orderBy(asc(agentActionsTable.sequence));
  }

  async findManyByThreadId(threadId: string) {
    return this.executor
      .select()
      .from(agentActionsTable)
      .where(eq(agentActionsTable.threadId, threadId))
      .orderBy(desc(agentActionsTable.sequence));
  }

  async findManyByRunId(runId: string) {
    return this.executor
      .select()
      .from(agentActionsTable)
      .where(eq(agentActionsTable.runId, runId))
      .orderBy(asc(agentActionsTable.sequence));
  }

  async create(data: typeof agentActionsTable.$inferInsert) {
    const rows = await this.executor.insert(agentActionsTable).values(data).returning();

    return rows[0]!;
  }

  async createIdempotent(data: typeof agentActionsTable.$inferInsert) {
    if (!data.idempotencyKey) {
      return { action: await this.create(data), created: true } as const;
    }
    const rows = await this.executor
      .insert(agentActionsTable)
      .values(data)
      .onConflictDoNothing({
        target: [
          agentActionsTable.threadId,
          agentActionsTable.toolName,
          agentActionsTable.idempotencyKey,
        ],
      })
      .returning();
    const created = rows[0];
    if (created) return { action: created, created: true } as const;
    const existing = await this.findByIdempotency(
      data.threadId,
      data.toolName,
      data.idempotencyKey,
    );
    if (!existing) {
      throw new Error(
        `Idempotent Agent action ${data.toolName}:${data.idempotencyKey} disappeared`,
      );
    }

    return { action: existing, created: false } as const;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof agentActionsTable.$inferInsert, "id" | "createdAt">>,
  ) {
    const rows = await this.executor
      .update(agentActionsTable)
      .set(patch)
      .where(eq(agentActionsTable.id, id))
      .returning();

    return rows[0] ?? null;
  }
}

export const createAgentActionsDao = (executor: DbExecutor) => new AgentActionsDao(executor);
