import { z } from "zod/v4";
import { NodeExecutionOverridesSchema } from "./ExecutionOptionsSchema";
import {
  ExecutionPortDefinitionSchema,
  ExecutionPortDefinitionsSchema,
} from "./ExecutionPortDefinitionSchema";
import {
  EXECUTION_MAX_PORTS,
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionPortIdSchema,
  ExecutionRevisionSchema,
} from "./ExecutionProtocolSchema";
import { ExecutionTextValueSchema, ExecutionValueSchema } from "./ExecutionValueSchema";

export const ExecutionConditionSchema = z.discriminatedUnion("operator", [
  z.strictObject({ operator: z.literal("non_empty"), negate: z.boolean().default(false) }),
  z.strictObject({
    operator: z.literal("equals"),
    expected: ExecutionValueSchema,
    negate: z.boolean().default(false),
  }),
  z.strictObject({
    operator: z.literal("contains"),
    expected: ExecutionTextValueSchema.shape.value.min(1),
    negate: z.boolean().default(false),
  }),
]);
export type ExecutionCondition = z.infer<typeof ExecutionConditionSchema>;

export const RuntimeNodeLoopSchema = z.strictObject({
  maxIterations: z.number().int().min(1).max(20),
  until: z.strictObject({ portId: ExecutionPortIdSchema, condition: ExecutionConditionSchema }),
  feedback: z
    .array(z.strictObject({ sourcePort: ExecutionPortIdSchema, targetPort: ExecutionPortIdSchema }))
    .superRefine((bindings, context) => {
      const targets = new Set<string>();
      bindings.forEach((binding, index) => {
        if (targets.has(binding.targetPort))
          context.addIssue({
            code: "custom",
            message: "Duplicate feedback target port",
            path: [index, "targetPort"],
          });
        targets.add(binding.targetPort);
      });
    })
    .default([]),
});
export type RuntimeNodeLoop = z.infer<typeof RuntimeNodeLoopSchema>;

const RetryableCodesSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(128)
      .refine((value) => value.trim().length > 0, "Retryable codes must not be blank"),
  )
  .max(32)
  .superRefine((values, context) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value))
        context.addIssue({ code: "custom", message: "Duplicate retryable code", path: [index] });
      seen.add(value);
    });
  })
  .meta({ uniqueItems: true });

export const RuntimeNodePortReferenceSchema = z.strictObject({
  nodeId: ExecutionIdentifierSchema,
  portId: ExecutionPortIdSchema,
});
export type RuntimeNodePortReference = z.infer<typeof RuntimeNodePortReferenceSchema>;

export const RuntimeEdgeSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("input"), portId: ExecutionPortIdSchema }),
  z.strictObject({ kind: z.literal("node"), ...RuntimeNodePortReferenceSchema.shape }),
]);
export type RuntimeEdgeSource = z.infer<typeof RuntimeEdgeSourceSchema>;

export const RuntimeNodeSchema = z.strictObject({
  id: ExecutionIdentifierSchema,
  operation: z.strictObject({
    operationId: ExecutionIdentifierSchema,
    revision: ExecutionRevisionSchema,
  }),
  executionOverrides: NodeExecutionOverridesSchema.default({}),
  failurePolicy: z.enum(["required", "best_effort"]).default("required"),
  retry: z
    .strictObject({
      maxAttempts: z.number().int().min(1).max(3).default(1),
      retryableCodes: RetryableCodesSchema.default([]),
    })
    .default({ maxAttempts: 1, retryableCodes: [] }),
  checkpoint: z.boolean().default(false),
  loop: RuntimeNodeLoopSchema.optional(),
});
export type RuntimeNode = z.infer<typeof RuntimeNodeSchema>;

export const RuntimeEdgeSchema = z.strictObject({
  id: ExecutionIdentifierSchema,
  source: RuntimeEdgeSourceSchema,
  target: RuntimeNodePortReferenceSchema,
  order: z.number().int().min(0),
  condition: ExecutionConditionSchema.optional(),
});
export type RuntimeEdge = z.infer<typeof RuntimeEdgeSchema>;

export const RuntimeGraphOutputSchema = z.strictObject({
  port: ExecutionPortDefinitionSchema,
  source: RuntimeNodePortReferenceSchema,
});
export type RuntimeGraphOutput = z.infer<typeof RuntimeGraphOutputSchema>;

export const RuntimeGraphSchema = z
  .strictObject({
    schemaVersion: ExecutionApiVersionSchema,
    inputs: ExecutionPortDefinitionsSchema,
    nodes: z.array(RuntimeNodeSchema).min(1).max(200),
    edges: z.array(RuntimeEdgeSchema).max(500),
    outputs: z.array(RuntimeGraphOutputSchema).max(EXECUTION_MAX_PORTS),
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set<string>();
    const inputIds = new Set(graph.inputs.map((port) => port.id));
    const edgeIds = new Set<string>();
    const bindings = new Set<string>();
    const outputIds = new Set<string>();
    const successors = new Map<string, string[]>();
    const indegree = new Map<string, number>();
    graph.nodes.forEach((node, index) => {
      if (nodeIds.has(node.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate node identifier",
          path: ["nodes", index, "id"],
        });
      nodeIds.add(node.id);
      successors.set(node.id, []);
      indegree.set(node.id, 0);
    });
    graph.edges.forEach((edge, index) => {
      if (edgeIds.has(edge.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate edge identifier",
          path: ["edges", index, "id"],
        });
      edgeIds.add(edge.id);
      const sourceKey =
        edge.source.kind === "node"
          ? ["node", edge.source.nodeId, edge.source.portId]
          : ["input", edge.source.portId];
      const binding = JSON.stringify([...sourceKey, edge.target.nodeId, edge.target.portId]);
      if (bindings.has(binding))
        context.addIssue({
          code: "custom",
          message: "Duplicate source-to-target port binding",
          path: ["edges", index],
        });
      bindings.add(binding);
      if (!nodeIds.has(edge.target.nodeId))
        context.addIssue({
          code: "custom",
          message: "Target node does not exist",
          path: ["edges", index, "target", "nodeId"],
        });
      if (edge.source.kind === "input") {
        if (!inputIds.has(edge.source.portId))
          context.addIssue({
            code: "custom",
            message: "Graph input does not exist",
            path: ["edges", index, "source", "portId"],
          });

        return;
      }
      if (!nodeIds.has(edge.source.nodeId))
        context.addIssue({
          code: "custom",
          message: "Source node does not exist",
          path: ["edges", index, "source", "nodeId"],
        });
      if (edge.source.nodeId === edge.target.nodeId)
        context.addIssue({
          code: "custom",
          message: "Self edges are not allowed",
          path: ["edges", index],
        });
      if (nodeIds.has(edge.source.nodeId) && nodeIds.has(edge.target.nodeId)) {
        successors.get(edge.source.nodeId)!.push(edge.target.nodeId);
        indegree.set(edge.target.nodeId, indegree.get(edge.target.nodeId)! + 1);
      }
    });
    graph.outputs.forEach((output, index) => {
      if (outputIds.has(output.port.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate graph output identifier",
          path: ["outputs", index, "port", "id"],
        });
      outputIds.add(output.port.id);
      if (!nodeIds.has(output.source.nodeId))
        context.addIssue({
          code: "custom",
          message: "Output source node does not exist",
          path: ["outputs", index, "source", "nodeId"],
        });
    });
    const ready = [...nodeIds].filter((id) => indegree.get(id) === 0);
    const visited = new Set<string>();
    while (ready.length > 0) {
      const id = ready.pop()!;
      visited.add(id);
      for (const next of successors.get(id)!) {
        const remaining = indegree.get(next)! - 1;
        indegree.set(next, remaining);
        if (remaining === 0) ready.push(next);
      }
    }
    if (visited.size !== nodeIds.size)
      context.addIssue({
        code: "custom",
        message: "Runtime graph must be acyclic",
        path: ["edges"],
      });
  });
export type RuntimeGraph = z.infer<typeof RuntimeGraphSchema>;
