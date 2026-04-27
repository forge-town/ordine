import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type {
  DistillationConfig,
  DistillationMode,
  DistillationSourceType,
  DistillationStatus,
} from "@repo/schemas";

export const distillationsTable = pgTable(
  "distillations",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    sourceType: text("source_type").$type<DistillationSourceType>().notNull().default("manual"),
    sourceId: text("source_id"),
    sourceLabel: text("source_label").notNull().default(""),
    mode: text("mode").$type<DistillationMode>().notNull().default("pipeline"),
    status: text("status").$type<DistillationStatus>().notNull().default("draft"),
    config: jsonb("config").$type<DistillationConfig>().notNull().default(sql`'{}'::jsonb`),
    inputSnapshot: jsonb("input_snapshot").$type<unknown>(),
    result: jsonb("result").$type<unknown>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("distillations_source_type_idx").on(table.sourceType),
    index("distillations_source_id_idx").on(table.sourceId),
    index("distillations_status_idx").on(table.status),
  ],
);

export type DistillationRecord = typeof distillationsTable.$inferSelect;
