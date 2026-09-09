import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ExecutionError, ExecutionNodeState, ExecutionPortValues } from "@repo/schemas";
import { executionJobsTable } from "./execution_jobs_table";

export const executionNodeAttemptsTable = pgTable(
  "execution_node_attempts",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    nodeId: text("node_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    iteration: integer("iteration").notNull().default(1),
    state: text("state").$type<ExecutionNodeState>().notNull().default("queued"),
    agentRunId: text("agent_run_id"),
    inputs: jsonb("inputs").$type<ExecutionPortValues>().notNull().default({}),
    outputs: jsonb("outputs").$type<ExecutionPortValues>(),
    error: jsonb("error").$type<ExecutionError>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "execution_node_attempts_state_check",
      sql`${table.state} IN ('queued','running','waiting_for_input','succeeded','failed','skipped','cancelled','timed_out','interrupted')`,
    ),
    uniqueIndex("execution_node_attempts_number_idx").on(
      table.jobId,
      table.nodeId,
      table.iteration,
      table.attemptNumber,
    ),
    unique("execution_node_attempts_owner_key").on(table.id, table.jobId, table.nodeId),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [executionJobsTable.id],
      name: "execution_node_attempts_job_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionNodeAttemptRecord = typeof executionNodeAttemptsTable.$inferSelect;
