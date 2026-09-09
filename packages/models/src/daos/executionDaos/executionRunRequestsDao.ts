import { and, eq } from "drizzle-orm";
import { executionRunRequestsTable as table } from "@repo/db-schema";
import type { ExecutionPrincipal, RunRequestReceipt } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export const createExecutionRunRequestsDao = (executor: DbExecutor) => ({
  async findScopedById(
    identity: Pick<ExecutionPrincipal, "workspaceId" | "subjectId">,
    id: string,
  ) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.id, id),
          eq(table.workspaceId, identity.workspaceId),
          eq(table.subjectId, identity.subjectId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async findByRequestId(
    identity: Pick<ExecutionPrincipal, "workspaceId" | "subjectId">,
    requestId: string,
  ) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, identity.workspaceId),
          eq(table.subjectId, identity.subjectId),
          eq(table.requestId, requestId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async findById(id: string) {
    const rows = await executor.select().from(table).where(eq(table.id, id)).limit(1);

    return rows[0] ?? null;
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
  async updateReceipt(id: string, receipt: RunRequestReceipt, now: Date) {
    const rows = await executor
      .update(table)
      .set({ receipt, state: receipt.state, updatedAt: now })
      .where(eq(table.id, id))
      .returning();

    return rows[0] ?? null;
  },
});
