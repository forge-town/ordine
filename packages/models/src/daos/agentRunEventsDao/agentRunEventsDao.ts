import { and, asc, eq, gt } from "drizzle-orm";
import { agentRunEventsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createAgentRunEventsDao = (executor: DbExecutor) => ({
  async create(data: typeof agentRunEventsTable.$inferInsert) {
    const rows = await executor.insert(agentRunEventsTable).values(data).returning();

    return rows[0]!;
  },

  async findManyByRunIdAfter(runId: string, sequence: number) {
    return executor
      .select()
      .from(agentRunEventsTable)
      .where(
        and(
          eq(agentRunEventsTable.runId, runId),
          gt(agentRunEventsTable.sequence, sequence),
        ),
      )
      .orderBy(asc(agentRunEventsTable.sequence));
  },
});
