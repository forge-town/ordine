import { integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import type { AgentRuntimeConfig } from "@repo/schemas";

export const executionRuntimeConfigsTable = pgTable(
  "execution_runtime_configs",
  {
    workspaceId: text("workspace_id").notNull(),
    id: text("id").notNull(),
    config: jsonb("config").$type<AgentRuntimeConfig>().notNull(),
    revision: integer("revision").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.id], name: "execution_runtime_configs_pk" }),
  ],
);
export type ExecutionRuntimeConfigRecord = typeof executionRuntimeConfigsTable.$inferSelect;
