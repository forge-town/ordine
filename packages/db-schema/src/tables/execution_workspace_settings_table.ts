import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import type { ExecutionOverrides } from "@repo/schemas";

export const executionWorkspaceSettingsTable = pgTable("execution_workspace_settings", {
  workspaceId: text("workspace_id").primaryKey(),
  executionDefaults: jsonb("execution_defaults").$type<ExecutionOverrides>().notNull(),
  revision: integer("revision").notNull(),
});
export type ExecutionWorkspaceSettingsRecord = typeof executionWorkspaceSettingsTable.$inferSelect;
