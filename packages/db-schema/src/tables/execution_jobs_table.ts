import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ExecutionError, ExecutionJobState, ExecutionWarnings } from "@repo/schemas";
import { executionRunRequestsTable } from "./execution_run_requests_table";

export const executionJobsTable = pgTable(
  "execution_jobs",
  {
    id: text("id").primaryKey(),
    runRequestId: text("run_request_id").notNull(),
    preparedRunId: text("prepared_run_id").notNull(),
    workspaceId: text("workspace_id").notNull(),
    subjectId: text("subject_id").notNull(),
    state: text("state").$type<ExecutionJobState>().notNull().default("queued"),
    executorId: text("executor_id"),
    generation: integer("generation").notNull().default(0),
    revision: integer("revision").notNull().default(0),
    runtimeEventCount: integer("runtime_event_count").notNull().default(0),
    runtimeEventBytes: integer("runtime_event_bytes").notNull().default(0),
    activeRemainingMs: integer("active_remaining_ms").notNull().default(3_600_000),
    waitingRemainingMs: integer("waiting_remaining_ms").notNull().default(86_400_000),
    pauseRequestedAt: timestamp("pause_requested_at", { withTimezone: true }),
    stopReason: text("stop_reason", { enum: ["cancelled", "timed_out"] }),
    warnings: jsonb("warnings").$type<ExecutionWarnings>().notNull().default([]),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    waitingDeadlineAt: timestamp("waiting_deadline_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: jsonb("error").$type<ExecutionError>(),
  },
  (table) => [
    check(
      "execution_jobs_event_budget_check",
      sql`${table.runtimeEventCount} >= 0 AND ${table.runtimeEventBytes} >= 0`,
    ),
    check(
      "execution_jobs_budget_check",
      sql`${table.activeRemainingMs} >= 0 AND ${table.waitingRemainingMs} >= 0 AND ${table.revision} >= 0 AND ${table.generation} >= 0`,
    ),
    check(
      "execution_jobs_stop_reason_check",
      sql`${table.stopReason} IS NULL OR ${table.stopReason} IN ('cancelled','timed_out')`,
    ),
    check(
      "execution_jobs_state_check",
      sql`${table.state} IN ('queued','running','pausing','paused','waiting_for_input','cancelling','succeeded','failed','cancelled','timed_out','interrupted')`,
    ),
    uniqueIndex("execution_jobs_request_idx").on(table.runRequestId),
    unique("execution_jobs_prepared_key").on(table.id, table.preparedRunId),
    index("execution_jobs_state_lease_idx").on(table.state, table.leaseExpiresAt),
    foreignKey({
      columns: [table.runRequestId, table.workspaceId, table.subjectId, table.preparedRunId],
      foreignColumns: [
        executionRunRequestsTable.id,
        executionRunRequestsTable.workspaceId,
        executionRunRequestsTable.subjectId,
        executionRunRequestsTable.preparedRunId,
      ],
      name: "execution_jobs_request_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionJobRecord = typeof executionJobsTable.$inferSelect;
