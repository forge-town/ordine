import { and, asc, eq, inArray } from "drizzle-orm";
import { executionNodeAttemptsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";
import type { ExecutionNodeState } from "@repo/schemas";

export const createExecutionNodeAttemptsDao = (executor: DbExecutor) => ({
  async findById(jobId: string, id: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(and(eq(table.id, id), eq(table.jobId, jobId)))
      .limit(1);

    return rows[0] ?? null;
  },
  async transition(
    jobId: string,
    id: string,
    from: ExecutionNodeState[],
    patch: Partial<
      Pick<typeof table.$inferInsert, "state" | "outputs" | "error" | "agentRunId" | "finishedAt">
    >,
  ) {
    const rows = await executor
      .update(table)
      .set(patch)
      .where(and(eq(table.id, id), eq(table.jobId, jobId), inArray(table.state, from)))
      .returning();

    return rows[0] ?? null;
  },
  async listByJob(jobId: string) {
    return executor
      .select()
      .from(table)
      .where(eq(table.jobId, jobId))
      .orderBy(asc(table.nodeId), asc(table.iteration), asc(table.attemptNumber));
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
