import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { agentRunEventsTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createAgentRunEventsDao = (executor: DbExecutor) => ({
  async create(data: typeof agentRunEventsTable.$inferInsert) {
    const rows = await executor.insert(agentRunEventsTable).values(data).returning();

    return rows[0]!;
  },

  async findManyByRunIdAfter(runId: string, sequence: number, limit = 500) {
    return executor
      .select()
      .from(agentRunEventsTable)
      .where(and(eq(agentRunEventsTable.runId, runId), gt(agentRunEventsTable.sequence, sequence)))
      .orderBy(asc(agentRunEventsTable.sequence))
      .limit(limit);
  },

  async findTerminalByRunId(runId: string) {
    const rows = await executor
      .select()
      .from(agentRunEventsTable)
      .where(
        and(
          eq(agentRunEventsTable.runId, runId),
          sql`${agentRunEventsTable.event}->>'type' = 'terminal'`,
        ),
      )
      .orderBy(desc(agentRunEventsTable.sequence))
      .limit(1);

    return rows[0] ?? null;
  },
});
