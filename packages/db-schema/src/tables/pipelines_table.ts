import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, integer, pgTable } from "drizzle-orm/pg-core";
import type { PipelineNode, PipelineEdge, PipelineStatus } from "@repo/schemas";
import { projectsTable } from "./projects_table";

export const pipelinesTable = pgTable("pipelines", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projectsTable.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sharedContext: text("shared_context").notNull().default(""),
  status: text("status").$type<PipelineStatus>().notNull().default("draft"),
  version: integer("version").notNull().default(1),
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
  timeoutMs: integer("timeout_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type PipelineRecord = typeof pipelinesTable.$inferSelect;
