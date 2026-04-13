import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable } from "drizzle-orm/pg-core";
import { githubProjectsTable } from "./github_projects_table";

export type WorkObjectType = "file" | "folder" | "project";
export type WorkStatus = "pending" | "running" | "success" | "failed";

export interface WorkObject {
  type: WorkObjectType;
  path: string;
}

export const worksTable = pgTable("works", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => githubProjectsTable.id, { onDelete: "cascade" }),
  pipelineId: text("pipeline_id").notNull(),
  pipelineName: text("pipeline_name").notNull(),
  object: jsonb("object").$type<WorkObject>().notNull(),
  status: text("status").$type<WorkStatus>().notNull().default("pending"),
  logs: text("logs")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type WorkRow = typeof worksTable.$inferSelect;
export type NewWorkRow = typeof worksTable.$inferInsert;
