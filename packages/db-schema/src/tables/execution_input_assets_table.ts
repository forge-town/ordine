import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { ExecutionInputAsset } from "@repo/schemas";

export const executionInputAssetsTable = pgTable(
  "execution_input_assets",
  {
    artifactId: text("artifact_id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    subjectId: text("subject_id").notNull(),
    metadata: jsonb("metadata").$type<ExecutionInputAsset>().notNull(),
    storageKey: text("storage_key").notNull(),
    importRequestId: uuid("import_request_id").notNull(),
    inputHash: text("input_hash").notNull(),
  },
  (table) => [
    uniqueIndex("execution_input_assets_storage_idx").on(table.storageKey),
    uniqueIndex("execution_input_assets_idempotency_idx").on(
      table.workspaceId,
      table.subjectId,
      table.importRequestId,
    ),
  ],
);
export type ExecutionInputAssetRecord = typeof executionInputAssetsTable.$inferSelect;
