import { z } from "zod/v4";
import {
  ExecutionIdentifierSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
} from "@repo/schemas";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const reason = z.string().trim().min(1).max(4000);
export const MigrationObjectKindSchema = z.enum([
  "operation",
  "pipeline",
  "job",
  "artifact",
  "runtime",
  "trace",
  "session",
  "approval",
]);
export const MigrationSourceSchema = z.strictObject({
  format: z.literal("ordine-legacy-offline-export/1"),
  sourceVersion: reason,
  sourceWorkspaceId: ExecutionIdentifierSchema,
  exportedAt: z.iso.datetime(),
  writesStopped: z.literal(true),
  credentialsAudit: z.literal("no_plaintext_credentials"),
  objects: z
    .array(
      z.strictObject({
        kind: MigrationObjectKindSchema,
        id: ExecutionIdentifierSchema,
        data: z.record(z.string(), z.json()),
      }),
    )
    .max(10_000),
});
export const MigrationDispositionSchema = z.strictObject({
  // RFC 6901 pointer to every leaf, including empty containers. Parents cannot hide children.
  path: z.string().max(4000),
  action: z.enum(["rebuilt", "discarded", "archived"]),
  reason,
});
export const ExecutionMigrationBundleSchema = z.strictObject({
  format: z.literal("ordine-execution-offline-bundle/1"),
  strategy: z.literal("manual_rebuilt"),
  sourceSha256: sha,
  targetWorkspaceId: ExecutionIdentifierSchema,
  decisionBy: reason,
  decidedAt: z.iso.datetime(),
  credentialsAudit: z.literal("no_plaintext_credentials"),
  selected: z
    .array(
      z.strictObject({ kind: z.enum(["operation", "pipeline"]), id: ExecutionIdentifierSchema }),
    )
    .max(10_000),
  objects: z
    .array(
      z.strictObject({
        kind: MigrationObjectKindSchema,
        oldId: ExecutionIdentifierSchema,
        sourceObjectSha256: sha,
        decision: z.enum(["rebuilt", "rejected", "manual_required", "archive_only"]),
        reason,
        warnings: z.array(reason).max(100),
        fieldDispositions: z.array(MigrationDispositionSchema).max(100_000),
        compoundResolution: z.enum([
          "not_present",
          "explicitly_rebuilt",
          "archived_without_execution",
        ]),
        mapping: z
          .strictObject({ newId: ExecutionIdentifierSchema, revision: z.literal(1) })
          .optional(),
      }),
    )
    .max(10_000),
  operations: z.array(OperationRevisionSchema).max(10_000),
  pipelines: z.array(PipelineDefinitionSchema).max(10_000),
});
export type ExecutionMigrationBundle = z.infer<typeof ExecutionMigrationBundleSchema>;
export type MigrationSource = z.infer<typeof MigrationSourceSchema>;
