import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { PipelineAgentMessageKind, PipelineAgentMessageRole } from "@repo/schemas";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const pipelineAgentMessagesTable = pgTable("pipeline_agent_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
  role: text("role").$type<PipelineAgentMessageRole>().notNull(),
  kind: text("kind").$type<PipelineAgentMessageKind>().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type PipelineAgentMessageRecord = typeof pipelineAgentMessagesTable.$inferSelect;
