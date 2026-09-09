import { and, eq, sql } from "drizzle-orm";
import { executionApprovalsTable as table } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export const createExecutionApprovalsDao = (executor: DbExecutor) => ({
  async findById(id: string) {
    const rows = await executor.select().from(table).where(eq(table.id, id)).limit(1);

    return rows[0] ?? null;
  },
  async create(data: typeof table.$inferInsert) {
    const rows = await executor.insert(table).values(data).returning();

    return rows[0]!;
  },
  async decide(id: string, state: "approved" | "rejected" | "expired", now: Date) {
    const expiration =
      state === "expired"
        ? sql`${table.expiresAt} <= clock_timestamp()`
        : sql`${table.expiresAt} > clock_timestamp()`;
    const rows = await executor
      .update(table)
      .set({ state, decidedAt: now })
      .where(and(eq(table.id, id), eq(table.state, "pending"), expiration))
      .returning();

    return rows[0] ?? null;
  },
});
