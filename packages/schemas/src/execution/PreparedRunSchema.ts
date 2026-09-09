import { z } from "zod/v4";
import {
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionTimestampSchema,
} from "./ExecutionProtocolSchema";
import { ExecutionPortValuesSchema } from "./ExecutionValueSchema";
import { OperationRevisionSchema } from "./OperationRevisionSchema";
import { PipelineDefinitionSchema } from "./PipelineDefinitionSchema";
import { ResolvedNodeExecutionSchema } from "./ResolvedNodeExecutionSchema";
import { ExecutionDeliveryRequirementSchema } from "./RunRequestSchema";
import { ExecutionInputArtifactSnapshotSchema } from "./ExecutionInputArtifactSnapshotSchema";

export const PreparedRunSchema = z
  .strictObject({
    apiVersion: ExecutionApiVersionSchema,
    id: ExecutionIdentifierSchema,
    subjectId: ExecutionIdentifierSchema,
    workspaceId: ExecutionIdentifierSchema,
    createdAt: ExecutionTimestampSchema,
    pipeline: PipelineDefinitionSchema,
    operations: z.array(OperationRevisionSchema).max(200),
    resolvedNodes: z.record(ExecutionIdentifierSchema, ResolvedNodeExecutionSchema),
    inputs: ExecutionPortValuesSchema,
    inputArtifacts: z.array(ExecutionInputArtifactSnapshotSchema).max(256).default([]),
    deliveryRequirements: z.array(ExecutionDeliveryRequirementSchema).max(64),
    credentialRefs: z.array(ExecutionIdentifierSchema).max(64).default([]),
    risk: z.strictObject({
      requiresApproval: z.boolean(),
      reasons: z.array(z.string().min(1).max(1000)).max(200),
    }),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .superRefine((value, context) => {
    const operationKeys = new Set<string>();
    const usedKeys = new Set<string>();
    value.operations.forEach((operation, index) => {
      const key = `${operation.id}:${operation.revision}`;
      if (operationKeys.has(key))
        context.addIssue({
          code: "custom",
          message: "Duplicate immutable Operation revision",
          path: ["operations", index],
        });
      operationKeys.add(key);
    });
    const nodeIds = new Set(value.pipeline.graph.nodes.map((node) => node.id));
    const jobTimeouts = Object.values(value.resolvedNodes)[0]?.timeouts;
    for (const [nodeId, resolved] of Object.entries(value.resolvedNodes)) {
      if (
        jobTimeouts &&
        (resolved.timeouts.activeRunTimeoutMs !== jobTimeouts.activeRunTimeoutMs ||
          resolved.timeouts.waitingTimeoutMs !== jobTimeouts.waitingTimeoutMs)
      )
        context.addIssue({
          code: "custom",
          message: "All nodes must share the same Job active and waiting budgets",
          path: ["resolvedNodes", nodeId, "timeouts"],
        });
    }
    value.pipeline.graph.nodes.forEach((node, index) => {
      const key = `${node.operation.operationId}:${node.operation.revision}`;
      usedKeys.add(key);
      if (!operationKeys.has(key))
        context.addIssue({
          code: "custom",
          message: "Prepared run is missing the pinned Operation revision",
          path: ["pipeline", "graph", "nodes", index, "operation"],
        });
      if (!Object.hasOwn(value.resolvedNodes, node.id))
        context.addIssue({
          code: "custom",
          message: "Prepared run is missing resolved node execution",
          path: ["resolvedNodes", node.id],
        });
      const operation = value.operations.find((item) => `${item.id}:${item.revision}` === key);
      if (operation && value.resolvedNodes[node.id]?.executorKind !== operation.executor.kind)
        context.addIssue({
          code: "custom",
          message: "Resolved executor kind differs from pinned Operation",
          path: ["resolvedNodes", node.id],
        });
    });
    value.operations.forEach((operation, index) => {
      if (!usedKeys.has(`${operation.id}:${operation.revision}`))
        context.addIssue({
          code: "custom",
          message: "Unreferenced Operation must not be included in PreparedRun",
          path: ["operations", index],
        });
    });
    for (const id of Object.keys(value.resolvedNodes)) {
      if (!nodeIds.has(id))
        context.addIssue({
          code: "custom",
          message: "Resolved execution references an unknown node",
          path: ["resolvedNodes", id],
        });
    }
    const inputIds = new Set(value.pipeline.graph.inputs.map((port) => port.id));
    for (const id of Object.keys(value.inputs)) {
      if (!inputIds.has(id))
        context.addIssue({
          code: "custom",
          message: "Input references an unknown graph port",
          path: ["inputs", id],
        });
    }
    const referencedArtifacts = new Set(
      Object.values(value.inputs).flatMap((items) =>
        items.flatMap((item) => (item.kind === "artifact" ? [item.artifactId] : [])),
      ),
    );
    for (const operation of value.operations) {
      if (
        operation.executor.kind === "builtin" &&
        operation.executor.name === "materialize_file" &&
        typeof operation.executor.config["assetId"] === "string"
      )
        referencedArtifacts.add(operation.executor.config["assetId"]);
    }
    const snapshotIds = new Set<string>();
    value.inputArtifacts.forEach((snapshot, index) => {
      if (snapshotIds.has(snapshot.artifactId) || !referencedArtifacts.has(snapshot.artifactId))
        context.addIssue({
          code: "custom",
          message: "Duplicate or unreferenced input artifact snapshot",
          path: ["inputArtifacts", index],
        });
      snapshotIds.add(snapshot.artifactId);
    });
    for (const id of referencedArtifacts) {
      if (!snapshotIds.has(id))
        context.addIssue({
          code: "custom",
          message: "Input artifact is missing its immutable content fingerprint",
          path: ["inputArtifacts"],
        });
    }
    if (value.risk.requiresApproval !== value.risk.reasons.length > 0)
      context.addIssue({
        code: "custom",
        message: "Approval flag and risk reasons must agree",
        path: ["risk"],
      });
  });
export type PreparedRun = z.infer<typeof PreparedRunSchema>;
