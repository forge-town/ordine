import { text, timestamp, pgTable, index } from "drizzle-orm/pg-core";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "expired";
export type JobType = "pipeline_run" | "distillation_run" | "refinement_run";

export const jobsTable = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    type: text("type").$type<JobType>().notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    parentJobId: text("parent_job_id"),
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
  ],
);
export type JobRecord = typeof jobsTable.$inferSelect;
