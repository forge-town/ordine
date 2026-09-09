import { jsonb, pgTable, text, unique } from "drizzle-orm/pg-core";
import type { PreparedRun } from "@repo/schemas";

export const executionPreparedRunsTable = pgTable(
  "execution_prepared_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    subjectId: text("subject_id").notNull(),
    prepared: jsonb("prepared").$type<PreparedRun>().notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    unique("execution_prepared_runs_identity_key").on(table.id, table.workspaceId, table.subjectId),
  ],
);
export type ExecutionPreparedRunRecord = typeof executionPreparedRunsTable.$inferSelect;
