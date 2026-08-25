import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  AgentContextEnvelope,
  PipelineAgentMessageKind,
  PipelineAgentMessageRole,
} from "@repo/schemas";
import { agentRunsTable } from "./agent_runs_table";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const pipelineAgentMessagesTable = pgTable("pipeline_agent_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
  role: text("role").$type<PipelineAgentMessageRole>().notNull(),
  kind: text("kind").$type<PipelineAgentMessageKind>().notNull(),
  content: text("content").notNull(),
  context: jsonb("context").$type<AgentContextEnvelope | null>(),
  runId: text("run_id").references(() => agentRunsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PipelineAgentMessageRecord = typeof pipelineAgentMessagesTable.$inferSelect;
