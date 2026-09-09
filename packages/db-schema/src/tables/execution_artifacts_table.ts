import { sql } from "drizzle-orm";
import { check, foreignKey, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import type { ExecutionArtifact, ExecutionArtifactState } from "@repo/schemas";
import { executionNodeAttemptsTable } from "./execution_node_attempts_table";

export const executionArtifactsTable = pgTable(
  "execution_artifacts",
  {
    artifactId: text("artifact_id").primaryKey(),
    jobId: text("job_id").notNull(),
    nodeId: text("node_id").notNull(),
    portId: text("port_id").notNull(),
    attemptId: text("attempt_id").notNull(),
    metadata: jsonb("metadata").$type<ExecutionArtifact>().notNull(),
    storageKey: text("storage_key").notNull(),
    state: text("state").$type<ExecutionArtifactState>().notNull().default("staged"),
  },
  (table) => [
    check(
      "execution_artifacts_metadata_check",
      sql`${table.metadata}->>'artifactId' IS NOT DISTINCT FROM ${table.artifactId} AND ${table.metadata}->>'jobId' IS NOT DISTINCT FROM ${table.jobId} AND ${table.metadata}->>'nodeId' IS NOT DISTINCT FROM ${table.nodeId} AND ${table.metadata}->>'portId' IS NOT DISTINCT FROM ${table.portId} AND ${table.metadata}->>'attemptId' IS NOT DISTINCT FROM ${table.attemptId} AND ${table.metadata}->>'state' IS NOT DISTINCT FROM ${table.state}`,
    ),
    check(
      "execution_artifacts_state_check",
      sql`${table.state} IN ('staged','validated','published','rejected')`,
    ),
    uniqueIndex("execution_artifacts_storage_idx").on(table.storageKey),
    foreignKey({
      columns: [table.attemptId, table.jobId, table.nodeId],
      foreignColumns: [
        executionNodeAttemptsTable.id,
        executionNodeAttemptsTable.jobId,
        executionNodeAttemptsTable.nodeId,
      ],
      name: "execution_artifacts_attempt_fk",
    }).onDelete("restrict"),
  ],
);
export type ExecutionArtifactRecord = typeof executionArtifactsTable.$inferSelect;
