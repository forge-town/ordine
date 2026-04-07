import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable } from "drizzle-orm/pg-core";
import type { PipelineNode, PipelineEdge } from "@/models/types/pipelineGraph";

export const pipelinesTable = pgTable("pipelines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  tags: jsonb("tags")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  nodes: jsonb("nodes")
    .$type<PipelineNode[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  edges: jsonb("edges")
    .$type<PipelineEdge[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PipelineRow = typeof pipelinesTable.$inferSelect;
export type NewPipelineRow = typeof pipelinesTable.$inferInsert;
