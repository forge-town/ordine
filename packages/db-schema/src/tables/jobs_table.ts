import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable, index } from "drizzle-orm/pg-core";
import { githubProjectsTable } from "./github_projects_table";
import { pipelinesTable } from "./pipelines_table";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";
export type JobType = "pipeline_run" | "code_analysis" | "skill_execution" | "file_scan" | "custom";

export interface JobResult {
  output?: string;
  summary?: string;
}

export const jobsTable = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: text("type").$type<JobType>().notNull().default("custom"),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    projectId: text("project_id").references(() => githubProjectsTable.id),
    pipelineId: text("pipeline_id").references(() => pipelinesTable.id),
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
  },
  (table) => ({
    projectIdx: index("jobs_project_id_idx").on(table.projectId),
    pipelineIdx: index("jobs_pipeline_id_idx").on(table.pipelineId),
    statusIdx: index("jobs_status_idx").on(table.status),
    typeIdx: index("jobs_type_idx").on(table.type),
  }),
);

export type JobRecord = typeof jobsTable.$inferSelect;