import { and, eq } from "drizzle-orm";
import { executionPreparedRunsTable as table } from "@repo/db-schema";
import type { ExecutionPrincipal } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export const createExecutionPreparedRunsDao = (executor: DbExecutor) => ({
  async findById(identity: Pick<ExecutionPrincipal, "workspaceId" | "subjectId">, id: string) {
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
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
