import { sql } from "drizzle-orm";
import { text, timestamp, jsonb, pgTable, index } from "drizzle-orm/pg-core";
import { jobsTable } from "./jobs_table";
import { pipelinesTable } from "./pipelines_table";
import { githubProjectsTable } from "./github_projects_table";

export interface PipelineRunResult {
  output?: string;
  summary?: string;
}

export const pipelineRunsTable = pgTable(
  "pipeline_runs",
  {
    id: text("id")
      .primaryKey()
      .references(() => jobsTable.id, { onDelete: "cascade" }),
    pipelineId: text("pipeline_id").references(() => pipelinesTable.id),
    projectId: text("project_id").references(() => githubProjectsTable.id),
    inputPath: text("input_path"),
    logs: text("logs")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    result: jsonb("result").$type<PipelineRunResult>(),
    tmuxSessionName: text("tmux_session_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("pipeline_runs_pipeline_id_idx").on(table.pipelineId),
    index("pipeline_runs_project_id_idx").on(table.projectId),
  ],
);
export type PipelineRunRecord = typeof pipelineRunsTable.$inferSelect;
