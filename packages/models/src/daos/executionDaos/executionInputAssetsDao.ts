import { and, eq } from "drizzle-orm";
import { executionInputAssetsTable as table } from "@repo/db-schema";
import type { ExecutionPrincipal } from "@repo/schemas";
import type { DbExecutor } from "../../types";

export const createExecutionInputAssetsDao = (executor: DbExecutor) => ({
  async findById(
    identity: Pick<ExecutionPrincipal, "workspaceId" | "subjectId">,
    artifactId: string,
  ) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, identity.workspaceId),
          eq(table.subjectId, identity.subjectId),
          eq(table.artifactId, artifactId),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async findByImport(
    identity: Pick<ExecutionPrincipal, "workspaceId" | "subjectId">,
    importRequestId: string,
  ) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.workspaceId, identity.workspaceId),
          eq(table.subjectId, identity.subjectId),
          eq(table.importRequestId, importRequestId),
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
