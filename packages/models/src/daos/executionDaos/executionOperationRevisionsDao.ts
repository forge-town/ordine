import { and, eq } from "drizzle-orm";
import { executionOperationRevisionsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionOperationRevisionsDao = (executor: DbExecutor) => ({
  async findByRevision(workspaceId: string, id: string, revision: number) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(eq(table.workspaceId, workspaceId), eq(table.id, id), eq(table.revision, revision)),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
