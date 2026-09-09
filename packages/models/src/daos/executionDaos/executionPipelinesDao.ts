import { and, asc, eq } from "drizzle-orm";
import { executionPipelinesTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionPipelinesDao = (executor: DbExecutor) => ({
  async findById(workspaceId: string, id: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(and(eq(table.workspaceId, workspaceId), eq(table.id, id)))
      .limit(1);

    return rows[0] ?? null;
  },
  async list(workspaceId: string) {
    return executor
      .select()
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
      .orderBy(asc(table.id));
  },
  async insertIfAbsent(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).onConflictDoNothing().returning();

    return rows[0] ?? null;
  },
  async replace(data: typeof table.$inferInsert, expectedRevision: number) {
    const rows = await executor
      .update(table)
      .set({ revision: data.revision, definition: data.definition })
      .where(
        and(
          eq(table.workspaceId, data.workspaceId),
          eq(table.id, data.id),
          eq(table.revision, expectedRevision),
        ),
      )
      .returning();

    return rows[0] ?? null;
  },
});
