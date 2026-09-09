import { boolean, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const executionOperationHeadsTable = pgTable(
  "execution_operation_heads",
  {
    workspaceId: text("workspace_id").notNull(),
    id: text("id").notNull(),
    latestRevision: integer("latest_revision").notNull(),
    archived: boolean("archived").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.id], name: "execution_operation_heads_pk" }),
  ],
);
export type ExecutionOperationHeadRecord = typeof executionOperationHeadsTable.$inferSelect;
