import { foreignKey, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { ExecutionPortValues } from "@repo/schemas";
import { executionJobsTable } from "./execution_jobs_table";

export const executionPipelineRunsTable = pgTable(
  "execution_pipeline_runs",
  {
    jobId: text("job_id").primaryKey(),
    preparedRunId: text("prepared_run_id").notNull(),
    outputs: jsonb("outputs").$type<ExecutionPortValues>(),
  },
  (table) => [
    foreignKey({
      columns: [table.jobId, table.preparedRunId],
      foreignColumns: [executionJobsTable.id, executionJobsTable.preparedRunId],
      name: "execution_pipeline_runs_job_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionPipelineRunRecord = typeof executionPipelineRunsTable.$inferSelect;
