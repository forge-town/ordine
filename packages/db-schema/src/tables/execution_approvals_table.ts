import { sql } from "drizzle-orm";
import { check, foreignKey, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { executionRunRequestsTable } from "./execution_run_requests_table";

export const executionApprovalsTable = pgTable(
  "execution_approvals",
  {
    id: text("id").primaryKey(),
    runRequestId: text("run_request_id").notNull(),
    preparedHash: text("prepared_hash").notNull(),
    state: text("state", { enum: ["pending", "approved", "rejected", "expired"] })
      .notNull()
      .default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "execution_approvals_state_check",
      sql`${table.state} IN ('pending','approved','rejected','expired')`,
    ),
    uniqueIndex("execution_approvals_request_idx").on(table.runRequestId),
    foreignKey({
      columns: [table.runRequestId],
      foreignColumns: [executionRunRequestsTable.id],
      name: "execution_approvals_request_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionApprovalRecord = typeof executionApprovalsTable.$inferSelect;
