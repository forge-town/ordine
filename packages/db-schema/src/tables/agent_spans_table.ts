import { sql } from "drizzle-orm";
import { text, timestamp, pgTable, index, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";
import { agentRawExportsTable } from "./agent_raw_exports_table";

export type SpanType = "agent_run" | "llm_call" | "tool_call" | "tool_result";
export type SpanStatus = "running" | "completed" | "error";

export const agentSpansTable = pgTable(
  "agent_spans",
  {
    id: serial("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    rawExportId: integer("raw_export_id").references(() => agentRawExportsTable.id, {
      onDelete: "cascade",
    }),
    parentSpanId: integer("parent_span_id"),
    spanType: text("span_type").$type<SpanType>().notNull(),
    name: text("name").notNull(),
    input: text("input"),
    output: text("output"),
    modelId: text("model_id"),
    tokenInput: integer("token_input"),
    tokenOutput: integer("token_output"),
    durationMs: integer("duration_ms"),
    status: text("status").$type<SpanStatus>().notNull().default("running"),
    error: text("error"),
    metadata: jsonb("metadata"),
    startedAt: timestamp("started_at")
      .notNull()
      .default(sql`now()`),
    finishedAt: timestamp("finished_at"),
  },
  (table) => [
    index("agent_spans_job_id_idx").on(table.jobId),
    index("agent_spans_raw_export_id_idx").on(table.rawExportId),
    index("agent_spans_parent_span_id_idx").on(table.parentSpanId),
  ],
);
export type AgentSpanRecord = typeof agentSpansTable.$inferSelect;
