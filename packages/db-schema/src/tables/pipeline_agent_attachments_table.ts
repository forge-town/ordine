import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import type {
  PipelineAgentAttachmentParseStatus,
  PipelineAgentAttachmentSourceType,
} from "@repo/schemas";
import { pipelineAgentSessionsTable } from "./pipeline_agent_sessions_table";

export const pipelineAgentAttachmentsTable = pgTable("pipeline_agent_attachments", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => pipelineAgentSessionsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sourceType: text("source_type").$type<PipelineAgentAttachmentSourceType>().notNull(),
  storageKey: text("storage_key").notNull(),
  parseStatus: text("parse_status").$type<PipelineAgentAttachmentParseStatus>().notNull(),
  parseError: text("parse_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type PipelineAgentAttachmentRecord = typeof pipelineAgentAttachmentsTable.$inferSelect;
