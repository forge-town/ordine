import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  PipelineAgentContextArtifactContent,
  PipelineAgentContextArtifactKind,
} from "@repo/schemas";
import { pipelineAgentAttachmentsTable } from "./pipeline_agent_attachments_table";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const pipelineAgentContextArtifactsTable = pgTable("pipeline_agent_context_artifacts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id").references(() => pipelineAgentAttachmentsTable.id, {
    onDelete: "set null",
  }),
  kind: text("kind").$type<PipelineAgentContextArtifactKind>().notNull(),
  content: jsonb("content").$type<PipelineAgentContextArtifactContent>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type PipelineAgentContextArtifactRecord =
  typeof pipelineAgentContextArtifactsTable.$inferSelect;
