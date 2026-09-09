import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { RunRequestInput, RunRequestReceipt, RunRequestState } from "@repo/schemas";
import { executionPreparedRunsTable } from "./execution_prepared_runs_table";

export const executionRunRequestsTable = pgTable(
  "execution_run_requests",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    subjectId: text("subject_id").notNull(),
    requestId: uuid("request_id").notNull(),
    inputHash: text("input_hash").notNull(),
    input: jsonb("input").$type<RunRequestInput>().notNull(),
    preparedRunId: text("prepared_run_id").notNull(),
    state: text("state").$type<RunRequestState>().notNull(),
    receipt: jsonb("receipt").$type<RunRequestReceipt>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "execution_run_requests_state_check",
      sql`${table.state} IN ('awaiting_approval','accepted','rejected','expired','invalid')`,
    ),
    uniqueIndex("execution_run_requests_idempotency_idx").on(
      table.workspaceId,
      table.subjectId,
      table.requestId,
    ),
    unique("execution_run_requests_identity_key").on(
      table.id,
      table.workspaceId,
      table.subjectId,
      table.preparedRunId,
    ),
    foreignKey({
      columns: [table.preparedRunId, table.workspaceId, table.subjectId],
      foreignColumns: [
        executionPreparedRunsTable.id,
        executionPreparedRunsTable.workspaceId,
        executionPreparedRunsTable.subjectId,
      ],
      name: "execution_run_requests_prepared_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionRunRequestRecord = typeof executionRunRequestsTable.$inferSelect;
