import { and, asc, eq } from "drizzle-orm";
import { executionRuntimeConfigsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionRuntimeConfigsDao = (executor: DbExecutor) => ({
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
  async save(data: typeof table.$inferInsert, expectedRevision: number) {
    const rows =
      expectedRevision === 0
        ? await executor.insert(table).values(data).onConflictDoNothing().returning()
        : await executor
            .update(table)
            .set({ config: data.config, revision: data.revision })
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
