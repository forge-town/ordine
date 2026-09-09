import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ExecutionJsonObject } from "@repo/schemas";
import { executionJobsTable } from "./execution_jobs_table";
import { executionNodeAttemptsTable } from "./execution_node_attempts_table";

export const executionEventsTable = pgTable(
  "execution_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    jobId: text("job_id").notNull(),
    nodeId: text("node_id"),
    attemptId: text("attempt_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<ExecutionJsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("execution_events_checkpoint_ack_idx")
      .on(table.jobId, table.nodeId)
      .where(sql`${table.type} = 'checkpoint_acknowledged'`),
    check(
      "execution_events_attempt_node_check",
      sql`${table.attemptId} IS NULL OR ${table.nodeId} IS NOT NULL`,
    ),
    index("execution_events_job_sequence_idx").on(table.jobId, table.id),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [executionJobsTable.id],
      name: "execution_events_job_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.attemptId, table.jobId, table.nodeId],
      foreignColumns: [
        executionNodeAttemptsTable.id,
        executionNodeAttemptsTable.jobId,
        executionNodeAttemptsTable.nodeId,
      ],
      name: "execution_events_attempt_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionEventRecord = typeof executionEventsTable.$inferSelect;
