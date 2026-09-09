import { and, eq } from "drizzle-orm";
import { executionWorkspaceSettingsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionWorkspaceSettingsDao = (executor: DbExecutor) => ({
  async findByWorkspaceId(workspaceId: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
      .limit(1);

    return rows[0] ?? null;
  },
  async save(data: typeof table.$inferInsert, expectedRevision: number) {
    const rows =
      expectedRevision === 0
        ? await executor.insert(table).values(data).onConflictDoNothing().returning()
        : await executor
            .update(table)
            .set({ executionDefaults: data.executionDefaults, revision: data.revision })
            .where(
              and(eq(table.workspaceId, data.workspaceId), eq(table.revision, expectedRevision)),
            )
            .returning();

    return rows[0] ?? null;
  },
});
