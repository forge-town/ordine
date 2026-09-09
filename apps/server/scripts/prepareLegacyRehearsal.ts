import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join } from "node:path";
import { z } from "zod/v4";
import { hashExecutionJson } from "@repo/models";
import { OperationRevisionSchema, PipelineDefinitionSchema } from "@repo/schemas";
import {
  MigrationSourceSchema,
  ExecutionMigrationBundleSchema,
  migrationBytesSha256,
  migrationLeafPaths,
  validateExecutionMigration,
} from "@repo/services/execution-migration";

const [sourcePath, outputDirectory] = process.argv.slice(2);
assert(sourcePath && outputDirectory && isAbsolute(sourcePath) && isAbsolute(outputDirectory));
const old = z
  .object({
    operations: z.array(z.record(z.string(), z.json())),
    pipelines: z.array(z.record(z.string(), z.json())),
  })
  .parse(JSON.parse(await readFile(sourcePath, "utf8")));
const source = MigrationSourceSchema.parse({
  format: "ordine-legacy-offline-export/1",
  sourceVersion: "7f63ac3d4fb065ba1cf41a6d73ed614c484b63e1",
  sourceWorkspaceId: "E-isolated-baseline",
  exportedAt: new Date().toISOString(),
  writesStopped: true,
  credentialsAudit: "no_plaintext_credentials",
  objects: [
    ...old.operations.map((data) => ({ kind: "operation", id: data.id, data })),
    ...old.pipelines.map((data) => ({ kind: "pipeline", id: data.id, data })),
  ],
});
const producer = source.objects.find((item) => item.data.name === "E producer")!;
const consumer = source.objects.find((item) => item.data.name === "E consumer")!;
const pipeline = source.objects.find((item) => item.data.name === "E two-step attempt1")!;
assert(producer && consumer && pipeline);
const suffix = randomUUID();
const textPort = { id: "value", valueType: "text", cardinality: "one" };
const filePort = { id: "report", valueType: "artifact", cardinality: "one" };
const marker = "ORDINE_E_fdc5b9f8-12a8-4aed-a53d-a6453b3462cd";
const operations = [
  OperationRevisionSchema.parse({
    apiVersion: 2,
    id: `restored-producer-${suffix}`,
    revision: 1,
    name: "Rebuilt E producer",
    inputPorts: [],
    outputPorts: [textPort],
    executor: {
      kind: "script",
      language: "javascript",
      outputMode: "text",
      source: `setTimeout(()=>process.stdout.write(${JSON.stringify(marker)}),1200)`,
    },
  }),
  OperationRevisionSchema.parse({
    apiVersion: 2,
    id: `restored-consumer-${suffix}`,
    revision: 1,
    name: "Rebuilt E consumer and managed delivery",
    inputPorts: [textPort],
    outputPorts: [filePort],
    executor: {
      kind: "script",
      language: "javascript",
      outputMode: "manifest",
      source: `import fs from 'node:fs';const input=JSON.parse(fs.readFileSync(0,'utf8'));const s=input.inputs.value[0].value;if(s!==${JSON.stringify(marker)})process.exit(19);fs.writeFileSync('result.txt','CONSUMED:'+s+':VERIFIED','utf8');process.stdout.write(JSON.stringify({outputs:{report:[{kind:'file',relativePath:'result.txt',name:'result.txt',mimeType:'text/plain'}]}}));`,
    },
  }),
];
const rebuilt = PipelineDefinitionSchema.parse({
  apiVersion: 2,
  id: `restored-pipeline-${suffix}`,
  revision: 1,
  name: "Rebuilt E technical baseline",
  sharedContext: "",
  graph: {
    schemaVersion: 2,
    inputs: [],
    nodes: [
      { id: "producer", operation: { operationId: operations[0]!.id, revision: 1 } },
      { id: "consumer", operation: { operationId: operations[1]!.id, revision: 1 } },
    ],
    edges: [
      {
        id: "explicit-text",
        source: { kind: "node", nodeId: "producer", portId: "value" },
        target: { nodeId: "consumer", portId: "value" },
        order: 0,
      },
    ],
    outputs: [{ port: filePort, source: { nodeId: "consumer", portId: "report" } }],
  },
});
const mapping = new Map([
  [producer.id, operations[0]!.id],
  [consumer.id, operations[1]!.id],
  [pipeline.id, rebuilt.id],
]);
const sourceBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`, "utf8");
const bundle = ExecutionMigrationBundleSchema.parse({
  format: "ordine-execution-offline-bundle/1",
  strategy: "manual_rebuilt",
  sourceSha256: migrationBytesSha256(sourceBytes),
  targetWorkspaceId: "local",
  decisionBy: "root technical rehearsal of approved T0; not production data selection",
  decidedAt: new Date().toISOString(),
  credentialsAudit: "no_plaintext_credentials",
  selected: [producer, consumer, pipeline].map(({ kind, id }) => ({ kind, id })),
  objects: source.objects.map((object) => ({
    kind: object.kind,
    oldId: object.id,
    sourceObjectSha256: hashExecutionJson(object),
    decision: mapping.has(object.id) ? "rebuilt" : "archive_only",
    reason: mapping.has(object.id)
      ? "Preserve the reviewed unique-marker consumption and exact final bytes using explicit v2 ports. Merge old output-local-path into the consumer manifest."
      : "Keep nonselected failure/compound fixtures only in the restored legacy archive.",
    warnings: mapping.has(object.id)
      ? [
          "Old implicit INPUT_CONTENT and absolute output path are removed; renderer writes only an attempt-local managed artifact.",
        ]
      : [],
    fieldDispositions: migrationLeafPaths(object.data).map((path) => ({
      path,
      action:
        mapping.has(object.id) && /^\/(?:id|name|config\/executor|nodes|edges)(?:\/|$)/u.test(path)
          ? "rebuilt"
          : "archived",
      reason:
        mapping.has(object.id) && /^\/(?:id|name|config\/executor|nodes|edges)(?:\/|$)/u.test(path)
          ? "Explicit replacement: new IDs/revision pins and typed text edge; consumer uses stdin and managed manifest delivery instead of INPUT_CONTENT and output-local-path. The source field remains in the archive."
          : "Original metadata remains in the source archive and is not silently adopted by the new execution definition.",
    })),
    compoundResolution:
      object.data.name === "E compound" ? "archived_without_execution" : "not_present",
    ...(mapping.has(object.id) ? { mapping: { newId: mapping.get(object.id), revision: 1 } } : {}),
  })),
  operations,
  pipelines: [rebuilt],
});
const validated = validateExecutionMigration(bundle, sourceBytes);
assert(validated.isOk(), validated.isErr() ? validated.error.message : undefined);
await mkdir(outputDirectory, { recursive: true });
await writeFile(join(outputDirectory, "source.json"), sourceBytes, { flag: "wx" });
await writeFile(join(outputDirectory, "bundle.json"), `${JSON.stringify(bundle, null, 2)}\n`, {
  encoding: "utf8",
  flag: "wx",
});
console.log(
  JSON.stringify({
    selectedObjects: mapping.size,
    sourceObjects: source.objects.length,
    pipelineId: rebuilt.id,
    expectedText: `CONSUMED:${marker}:VERIFIED`,
  }),
);
