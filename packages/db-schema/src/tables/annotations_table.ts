import { sql } from "drizzle-orm";
import { text, timestamp, boolean, pgTable, index } from "drizzle-orm/pg-core";
import type { AnnotationAuthor, AnnotationTargetType } from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";

export const annotationsTable = pgTable(
  "annotations",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelinesTable.id, { onDelete: "cascade" }),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").$type<AnnotationTargetType>().notNull(),
    author: text("author").$type<AnnotationAuthor>().notNull(),
    content: text("content").notNull(),
    resolved: boolean("resolved").notNull().default(false),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    index("annotations_pipeline_id_idx").on(table.pipelineId),
    index("annotations_target_id_idx").on(table.targetId),
  ],
);
export type AnnotationRecord = typeof annotationsTable.$inferSelect;
