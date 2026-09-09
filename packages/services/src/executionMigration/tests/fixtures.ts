import { hashExecutionJson } from "@repo/models";
import { OperationRevisionSchema, PipelineDefinitionSchema } from "@repo/schemas";
import {
  ExecutionMigrationBundleSchema,
  MigrationSourceSchema,
  type MigrationSource,
} from "../migrationSchemas";
import { migrationBytesSha256, migrationLeafPaths } from "../validateExecutionMigration";

export const migrationFixture = () => {
  const source = MigrationSourceSchema.parse({
    format: "ordine-legacy-offline-export/1",
    sourceVersion: "legacy-test-only",
    sourceWorkspaceId: "legacy-workspace",
    exportedAt: "2026-09-08T00:00:00.000Z",
    writesStopped: true,
    credentialsAudit: "no_plaintext_credentials",
    objects: [
      {
        kind: "operation",
        id: "old-operation",
        data: {
          id: "old-operation",
          name: "旧操作",
          content: "Return the input",
          unknownLegacySetting: { enabled: true },
        },
      },
      {
        kind: "pipeline",
        id: "old-pipeline",
        data: {
          id: "old-pipeline",
          name: "旧管线",
          nodes: [{ operationId: "old-operation" }],
          edges: [],
        },
      },
      {
        kind: "job",
        id: "old-job",
        data: { id: "old-job", status: "done", result: "archived historical text" },
      },
      {
        kind: "operation",
        id: "old-compound",
        data: { id: "old-compound", type: "compound", children: ["old-operation"] },
      },
    ],
  });
  const sourceBytes = new TextEncoder().encode(`${JSON.stringify(source, null, 2)}\n`);
  const port = {
    id: "text",
    valueType: "text",
    cardinality: "one",
    required: true,
    allowEmpty: false,
  };
  const operation = OperationRevisionSchema.parse({
    apiVersion: 2,
    id: "new-operation",
    revision: 1,
    name: "Manual identity",
    inputPorts: [port],
    outputPorts: [port],
    executor: { kind: "builtin", name: "identity", config: {} },
  });
  const pipeline = PipelineDefinitionSchema.parse({
    apiVersion: 2,
    id: "new-pipeline",
    revision: 1,
    name: "Manual identity pipeline",
    graph: {
      schemaVersion: 2,
      inputs: [port],
      nodes: [{ id: "node-1", operation: { operationId: operation.id, revision: 1 } }],
      edges: [
        {
          id: "edge-1",
          source: { kind: "input", portId: "text" },
          target: { nodeId: "node-1", portId: "text" },
          order: 0,
        },
      ],
      outputs: [{ port, source: { nodeId: "node-1", portId: "text" } }],
    },
  });
  const bundle = ExecutionMigrationBundleSchema.parse({
    format: "ordine-execution-offline-bundle/1",
    strategy: "manual_rebuilt",
    sourceSha256: migrationBytesSha256(sourceBytes),
    targetWorkspaceId: "new-workspace",
    decisionBy: "fixture-product-reviewer",
    decidedAt: "2026-09-08T00:00:00.000Z",
    credentialsAudit: "no_plaintext_credentials",
    selected: [
      { kind: "operation", id: "old-operation" },
      { kind: "pipeline", id: "old-pipeline" },
    ],
    objects: source.objects.map((object, index) => ({
      kind: object.kind,
      oldId: object.id,
      sourceObjectSha256: hashExecutionJson(object),
      decision: index < 2 ? "rebuilt" : index === 2 ? "archive_only" : "rejected",
      reason:
        index < 2
          ? "Product explicitly requests a new identity behavior; equivalence is not claimed."
          : "Retain only in the readonly archive.",
      warnings: index === 0 ? ["unknownLegacySetting intentionally discarded by product"] : [],
      fieldDispositions: migrationLeafPaths(object.data).map((path) => ({
        path,
        action:
          index < 2
            ? path.includes("unknownLegacySetting")
              ? "discarded"
              : "rebuilt"
            : "archived",
        reason: path.includes("unknownLegacySetting")
          ? "Legacy setting intentionally discarded after product review."
          : index < 2
            ? "Reviewed while manually defining the new identity behavior."
            : "Historical data stays in readonly archive.",
      })),
      compoundResolution: index === 3 ? "archived_without_execution" : "not_present",
      ...(index < 2
        ? { mapping: { newId: index === 0 ? operation.id : pipeline.id, revision: 1 } }
        : {}),
    })),
    operations: [operation],
    pipelines: [pipeline],
  });

  return { source, sourceBytes, bundle };
};

export const replaceFixtureSource = (
  fixture: ReturnType<typeof migrationFixture>,
  source: MigrationSource,
) => {
  const sourceBytes = new TextEncoder().encode(JSON.stringify(source));
  fixture.source = source;
  fixture.sourceBytes = sourceBytes;
  fixture.bundle.sourceSha256 = migrationBytesSha256(sourceBytes);
  fixture.bundle.objects.forEach((entry, index) => {
    entry.sourceObjectSha256 = hashExecutionJson(source.objects[index]);
  });
};
