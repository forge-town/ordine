import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable } from "drizzle-orm/pg-core";
import { worksTable } from "./works_table";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobType =
  | "pipeline_run"
  | "code_analysis"
  | "skill_execution"
  | "file_scan"
  | "custom";

export interface JobResult {
  output?: string;
  summary?: string;
}

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").$type<JobType>().notNull().default("custom"),
  status: text("status").$type<JobStatus>().notNull().default("queued"),
  workId: text("work_id").references(() => worksTable.id, {
    onDelete: "set null",
  }),
  projectId: text("project_id"),
  pipelineId: text("pipeline_id"),
  logs: text("logs")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  result: jsonb("result").$type<JobResult>(),
  error: text("error"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type JobRow = typeof jobsTable.$inferSelect;
export type NewJobRow = typeof jobsTable.$inferInsert;
