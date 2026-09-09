import { and, asc, desc, eq, gt } from "drizzle-orm";
import { executionEventsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionEventsDao = (executor: DbExecutor) => ({
  async latestNodeStates(jobId: string) {
    return executor
      .selectDistinctOn([table.nodeId])
      .from(table)
      .where(and(eq(table.jobId, jobId), eq(table.type, "node_state")))
      .orderBy(asc(table.nodeId), desc(table.id));
  },
  async findCheckpointAcknowledgement(jobId: string, nodeId: string) {
    const rows = await executor
      .select()
      .from(table)
      .where(
        and(
          eq(table.jobId, jobId),
          eq(table.nodeId, nodeId),
          eq(table.type, "checkpoint_acknowledged"),
        ),
      )
      .limit(1);

    return rows[0] ?? null;
  },
  async listByJob(jobId: string, after = 0, limit = 500) {
    return executor
      .select()
      .from(table)
      .where(and(eq(table.jobId, jobId), gt(table.id, after)))
      .orderBy(asc(table.id))
      .limit(limit);
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
});
