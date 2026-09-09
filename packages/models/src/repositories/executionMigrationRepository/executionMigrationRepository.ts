import { sql } from "drizzle-orm";
import {
  ExecutionIdentifierSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  type OperationRevision,
  type PipelineDefinition,
} from "@repo/schemas";
import type { DbConnection } from "../../types";
import {
  createExecutionOperationHeadsDao,
  createExecutionOperationRevisionsDao,
  createExecutionPipelinesDao,
} from "../../daos/executionDaos";
import { hashExecutionJson } from "../executionRepository/executionHash";

const tables = [
  "execution_approvals",
  "execution_artifacts",
  "execution_events",
  "execution_input_assets",
  "execution_jobs",
  "execution_node_attempts",
  "execution_operation_heads",
  "execution_operation_revisions",
  "execution_pipeline_runs",
  "execution_pipelines",
  "execution_prepared_runs",
  "execution_run_requests",
  "execution_runtime_configs",
  "execution_workspace_settings",
];

export class ExecutionMigrationImportError extends Error {
  constructor(
    readonly code: "target_invalid" | "target_not_empty" | "definition_invalid" | "write_conflict",
  ) {
    super(`Offline import rejected: ${code}`);
    this.name = "ExecutionMigrationImportError";
  }
}

/** Offline-only. The caller supplies a connection verified by createExecutionDatabase. */
export const createExecutionMigrationRepository = (dependencies: {
  db: DbConnection;
  schema: string;
  migrationSha256: string;
}) => ({
  async importIntoEmptyWorkspace(input: {
    workspaceId: string;
    confirmNewWorkspace: true;
    operations: OperationRevision[];
    pipelines: PipelineDefinition[];
  }): Promise<void> {
    if (
      !/^[a-z_][a-z0-9_]{0,62}$/.test(dependencies.schema) ||
      dependencies.schema === "public" ||
      dependencies.schema.startsWith("pg_") ||
      !/^[a-f0-9]{64}$/.test(dependencies.migrationSha256) ||
      input.confirmNewWorkspace !== true ||
      !ExecutionIdentifierSchema.safeParse(input.workspaceId).success
    )
      throw new ExecutionMigrationImportError("target_invalid");
    if (
      input.operations.length + input.pipelines.length === 0 ||
      input.operations.some(
        (item) => !OperationRevisionSchema.safeParse(item).success || item.revision !== 1,
      ) ||
      input.pipelines.some(
        (item) => !PipelineDefinitionSchema.safeParse(item).success || item.revision !== 1,
      )
    )
      throw new ExecutionMigrationImportError("definition_invalid");

    await dependencies.db.transaction(async (tx) => {
      const current = await tx.execute(sql`SELECT current_schema() AS name`);
      if (current[0]?.["name"] !== dependencies.schema)
        throw new ExecutionMigrationImportError("target_invalid");
      const inventory = await tx.execute(
        sql`SELECT c.relname AS name FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${dependencies.schema} AND c.relkind IN ('r','p','v','m','f') ORDER BY c.relname`,
      );
      if (
        JSON.stringify(inventory.map((row) => row["name"])) !==
        JSON.stringify([...tables, "execution_schema_meta"].sort())
      )
        throw new ExecutionMigrationImportError("target_invalid");
      // Serialize imports and block ordinary writers throughout the empty check and all inserts.
      await tx.execute(
        sql`LOCK TABLE ${sql.join(
          [...tables, "execution_schema_meta"].map(
            (name) => sql`${sql.identifier(dependencies.schema)}.${sql.identifier(name)}`,
          ),
          sql`, `,
        )} IN ACCESS EXCLUSIVE MODE`,
      );
      const marker = await tx.execute(
        sql`SELECT schema_version, migration_sha256 FROM ${sql.identifier(dependencies.schema)}.${sql.identifier("execution_schema_meta")}`,
      );
      if (
        marker.length !== 1 ||
        marker[0]?.["schema_version"] !== 2 ||
        marker[0]?.["migration_sha256"] !== dependencies.migrationSha256
      )
        throw new ExecutionMigrationImportError("target_invalid");
      for (const name of tables) {
        const rows = await tx.execute(
          sql`SELECT 1 FROM ${sql.identifier(dependencies.schema)}.${sql.identifier(name)} LIMIT 1`,
        );
        if (rows.length > 0) throw new ExecutionMigrationImportError("target_not_empty");
      }
      const heads = createExecutionOperationHeadsDao(tx);
      const revisions = createExecutionOperationRevisionsDao(tx);
      const pipelines = createExecutionPipelinesDao(tx);
      for (const operation of input.operations) {
        if (
          !(await heads.insertIfAbsent({
            workspaceId: input.workspaceId,
            id: operation.id,
            latestRevision: 1,
          }))
        )
          throw new ExecutionMigrationImportError("write_conflict");
        await revisions.create({
          workspaceId: input.workspaceId,
          id: operation.id,
          revision: 1,
          definition: operation,
          contentHash: hashExecutionJson(operation),
        });
      }
      for (const pipeline of input.pipelines) {
        if (
          !(await pipelines.insertIfAbsent({
            workspaceId: input.workspaceId,
            id: pipeline.id,
            revision: 1,
            definition: pipeline,
          }))
        )
          throw new ExecutionMigrationImportError("write_conflict");
      }
    });
  },
});

export type ExecutionMigrationRepository = ReturnType<typeof createExecutionMigrationRepository>;
