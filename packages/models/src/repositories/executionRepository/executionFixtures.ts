import { randomUUID } from "node:crypto";
import {
  EXECUTION_TIMEOUT_DEFAULTS,
  ExecutionPrincipalSchema,
  OperationRevisionSchema,
  PipelineDefinitionSchema,
  PreparedRunSchema,
  RunRequestInputSchema,
} from "@repo/schemas";
import { hashPreparedRun } from "./executionHash";

export const executionFixture = (requiresApproval = false) => {
  const suffix = randomUUID();
  const principal = ExecutionPrincipalSchema.parse({
    subjectId: `subject-${suffix}`,
    workspaceId: `workspace-${suffix}`,
    scopes: [
      "definitions:read",
      "definitions:write",
      "execution:submit",
      "execution:approve",
      "execution:read",
    ],
  });
  const operation = OperationRevisionSchema.parse({
    apiVersion: 2,
    id: `operation-${suffix}`,
    revision: 1,
    name: "Identity",
    inputPorts: [{ id: "value", valueType: "text", cardinality: "one" }],
    outputPorts: [{ id: "value", valueType: "text", cardinality: "one" }],
    executor: { kind: "builtin", name: "identity" },
  });
  const pipeline = PipelineDefinitionSchema.parse({
    apiVersion: 2,
    id: `pipeline-${suffix}`,
    revision: 1,
    name: "Pipeline",
    graph: {
      schemaVersion: 2,
      inputs: [{ id: "value", valueType: "text", cardinality: "one" }],
      nodes: [{ id: "identity", operation: { operationId: operation.id, revision: 1 } }],
      edges: [
        {
          id: "input",
          source: { kind: "input", portId: "value" },
          target: { nodeId: "identity", portId: "value" },
          order: 0,
        },
      ],
      outputs: [
        {
          port: { id: "value", valueType: "text", cardinality: "one" },
          source: { nodeId: "identity", portId: "value" },
        },
      ],
    },
  });
  const input = RunRequestInputSchema.parse({
    apiVersion: 2,
    requestId: randomUUID(),
    pipelineId: pipeline.id,
    expectedRevision: 1,
    inputs: { value: [{ kind: "text", value: "hello" }] },
  });
  const prepared = PreparedRunSchema.parse({
    apiVersion: 2,
    id: `prepared-${suffix}`,
    subjectId: principal.subjectId,
    workspaceId: principal.workspaceId,
    createdAt: new Date().toISOString(),
    pipeline,
    operations: [operation],
    resolvedNodes: {
      identity: { executorKind: "builtin", timeouts: EXECUTION_TIMEOUT_DEFAULTS, origins: {} },
    },
    inputs: input.inputs,
    deliveryRequirements: [],
    risk: { requiresApproval, reasons: requiresApproval ? ["Script permission"] : [] },
    contentHash: "0".repeat(64),
  });
  prepared.contentHash = hashPreparedRun(prepared);

  return { principal, operation, pipeline, input, prepared };
};
