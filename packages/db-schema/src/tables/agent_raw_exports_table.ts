import { sql } from "drizzle-orm";
import { text, timestamp, pgTable, index, serial, integer, jsonb } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";

export type AgentSystem = "claude-code" | "codex" | "openai" | "anthropic" | "custom";
export type AgentRunStatus = "completed" | "error";

export const agentRawExportsTable = pgTable(
  "agent_raw_exports",
  {
    id: serial("id").primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    agentSystem: text("agent_system").$type<AgentSystem>().notNull(),
    agentId: text("agent_id").notNull(),
    modelId: text("model_id"),
    rawPayload: jsonb("raw_payload").notNull(),
    tokenInput: integer("token_input"),
    tokenOutput: integer("token_output"),
    durationMs: integer("duration_ms"),
    status: text("status").$type<AgentRunStatus>().notNull().default("completed"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("agent_raw_exports_job_id_idx").on(table.jobId),
    index("agent_raw_exports_created_at_idx").on(table.createdAt),
  ],
);
export type AgentRawExportRecord = typeof agentRawExportsTable.$inferSelect;
