import { integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { PipelineDefinition } from "@repo/schemas";

export const executionPipelinesTable = pgTable(
  "execution_pipelines",
  {
    workspaceId: text("workspace_id").notNull(),
    id: text("id").notNull(),
    revision: integer("revision").notNull(),
    definition: jsonb("definition").$type<PipelineDefinition>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.id], name: "execution_pipelines_pk" }),
  ],
);
export type ExecutionPipelineRecord = typeof executionPipelinesTable.$inferSelect;
