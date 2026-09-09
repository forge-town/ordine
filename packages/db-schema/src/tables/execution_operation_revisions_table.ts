import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";
import type { OperationRevision } from "@repo/schemas";
import { executionOperationHeadsTable } from "./execution_operation_heads_table";

export const executionOperationRevisionsTable = pgTable(
  "execution_operation_revisions",
  {
    workspaceId: text("workspace_id").notNull(),
    id: text("id").notNull(),
    revision: integer("revision").notNull(),
    definition: jsonb("definition").$type<OperationRevision>().notNull(),
    contentHash: text("content_hash").notNull(),
    revoked: boolean("revoked").notNull().default(false),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.id, table.revision],
      name: "execution_operation_revisions_pk",
    }),
    foreignKey({
      columns: [table.workspaceId, table.id],
      foreignColumns: [executionOperationHeadsTable.workspaceId, executionOperationHeadsTable.id],
      name: "execution_operation_revisions_head_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionOperationRevisionRecord = typeof executionOperationRevisionsTable.$inferSelect;
