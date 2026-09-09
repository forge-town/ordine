import { and, asc, eq } from "drizzle-orm";
import { executionOperationHeadsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionOperationHeadsDao = (executor: DbExecutor) => ({
  async list(workspaceId: string) {
    return executor
      .select()
      .from(table)
      .where(and(eq(table.workspaceId, workspaceId), eq(table.archived, false)))
      .orderBy(asc(table.id));
  },
  async findById(workspaceId: string, id: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(and(eq(table.workspaceId, workspaceId), eq(table.id, id)))
      .limit(1);

    return rows[0] ?? null;
  },
  async insertIfAbsent(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).onConflictDoNothing().returning();

    return rows[0] ?? null;
  },
  async advance(workspaceId: string, id: string, expectedRevision: number) {
    const rows = await executor
      .update(table)
      .set({ latestRevision: expectedRevision + 1 })
      .where(
        and(
          eq(table.workspaceId, workspaceId),
          eq(table.id, id),
          eq(table.latestRevision, expectedRevision),
          eq(table.archived, false),
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
});
