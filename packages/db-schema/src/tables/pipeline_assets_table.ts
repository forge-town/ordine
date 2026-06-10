import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, integer, numeric, pgTable, index } from "drizzle-orm/pg-core";
import type { PipelineAssetInputSlot, PipelineEdge, PipelineNode } from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";

export const pipelineAssetsTable = pgTable(
  "pipeline_assets",
  {
    id: text("id").primaryKey(),
    pipelineId: text("pipeline_id")
      .notNull()
      .references(() => pipelinesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    snapshotNodes: jsonb("snapshot_nodes").$type<PipelineNode[]>().notNull(),
    snapshotEdges: jsonb("snapshot_edges").$type<PipelineEdge[]>().notNull(),
    inputSlots: jsonb("input_slots")
      .$type<PipelineAssetInputSlot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    totalRuns: integer("total_runs").notNull().default(0),
    successRate: numeric("success_rate", { precision: 5, scale: 4 }),
    avgDurationMs: integer("avg_duration_ms"),
    tags: jsonb("tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (table) => [index("pipeline_assets_pipeline_id_idx").on(table.pipelineId)],
);
export type PipelineAssetRecord = typeof pipelineAssetsTable.$inferSelect;
