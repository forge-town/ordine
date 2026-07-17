import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { JobStatus, JobTriggeredBy, JobType, NodeRunStatus } from "@repo/schemas";
import { pipelinesTable } from "./pipelines_table";
import { projectsTable } from "./projects_table";

export const jobsTable = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: text("type").$type<JobType>().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    parentJobId: text("parent_job_id"),
    pipelineId: text("pipeline_id").references(() => pipelinesTable.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => projectsTable.id),
    totalTokens: integer("total_tokens"),
    triggeredBy: text("triggered_by").$type<JobTriggeredBy>().notNull().default("manual"),
    nodeStatuses: jsonb("node_statuses").$type<Record<string, NodeRunStatus>>(),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("jobs_status_idx").on(table.status),
    index("jobs_type_idx").on(table.type),
    index("jobs_parent_job_id_idx").on(table.parentJobId),
    index("jobs_pipeline_id_idx").on(table.pipelineId),
    index("jobs_project_id_idx").on(table.projectId),
  ],
);
export type JobRecord = typeof jobsTable.$inferSelect;
