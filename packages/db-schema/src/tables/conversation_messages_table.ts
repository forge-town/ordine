import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable, index } from "drizzle-orm/pg-core";
import type { ConversationMessageMetadata, ConversationRole } from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";

export const conversationMessagesTable = pgTable(
  "conversation_messages",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelinesTable.id, { onDelete: "cascade" }),
    role: text("role").$type<ConversationRole>().notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<ConversationMessageMetadata>(),
    phase: text("phase"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("conversation_messages_pipeline_id_idx").on(table.pipelineId),
    index("conversation_messages_created_at_idx").on(table.createdAt),
  ],
);
export type ConversationMessageRecord = typeof conversationMessagesTable.$inferSelect;
