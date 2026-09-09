import { z } from "zod/v4";
import { CanvasExecutionNodeSchema, CanvasExecutionEdgeSchema } from "./canvasAuthoringSchema";
import {
  InputPortSchema,
  OperationSchema,
  OperationNodeDataSchema,
  OperationRevisionSchema,
  OutputItemSchema,
  PipelineSchema,
  PipelineDefinitionContentSchema,
  ScriptLanguageSchema,
  ScriptOutputModeSchema,
  type TemplateContentType,
  type Operation,
  type OperationRevision,
  type PipelineData,
  type PipelineDefinitionContent,
  type RuntimeEdge,
  type ExecutionPortDefinition,
} from "@repo/schemas";

export const CanvasExecutionDiagnosticSchema = z.strictObject({
  code: z.enum([
    "unsupported_contract",
    "missing_revision",
    "missing_operation",
    "invalid_binding",
    "invalid_definition",
  ]),
  message: z.string(),
  path: z.array(z.union([z.string(), z.number()])),
  nodeId: z.string().optional(),
  operationId: z.string().optional(),
});
export type CanvasExecutionDiagnostic = z.infer<typeof CanvasExecutionDiagnosticSchema>;

export type CanvasExecutionConversion =
  | {
      success: true;
      operations: OperationRevision[];
      definition: PipelineDefinitionContent;
      diagnostics: [];
    }
  | { success: false; diagnostics: CanvasExecutionDiagnostic[] };

const SupportedInputSchema = InputPortSchema.strict().extend({
  id: z.string().min(1),
  kind: z.literal("prompt"),
  accepts: z.union([z.tuple([z.literal("text/plain")]), z.tuple([z.literal("application/json")])]),
});
export const canvasOutputMimeTypes: Record<TemplateContentType, readonly string[]> = {
  text: ["text/plain"],
  json: ["application/json"],
  markdown: ["text/markdown", "text/x-markdown"],
  html: ["text/html"],
  csv: ["text/csv"],
  yaml: ["application/yaml", "application/x-yaml", "text/yaml", "text/x-yaml"],
  xml: ["application/xml", "text/xml"],
};
const SupportedOutputSchema = OutputItemSchema.strict()
  .extend({
    id: z.string().min(1),
    cardinality: z.enum(["one", "many"]),
    required: z.boolean(),
  })
  .superRefine((port, context) => {
    if (port.templateIds.length > 0)
      context.addIssue({
        code: "custom",
        path: ["templateIds"],
        message:
          "Output templates require explicit materialization; template semantics cannot be discarded during conversion.",
      });
    port.produces?.forEach((mime, index) => {
      if (!canvasOutputMimeTypes[port.contentType].includes(mime.toLowerCase()))
        context.addIssue({
          code: "custom",
          path: ["produces", index],
          message: "Produced MIME type must match the declared textual content format.",
        });
    });
  });
const SupportedOperationSchema = OperationSchema.strict().extend({
  sourceSkillId: z.never().optional(),
  config: z.strictObject({
    executor: z.discriminatedUnion("type", [
      z.strictObject({
        type: z.literal("agent"),
        agentMode: z.literal("prompt"),
        agent: z.literal("codex").optional(),
        prompt: z.string().min(1),
        systemPrompt: z.string().optional(),
        model: z.string().optional(),
        allowedTools: z.array(z.never()).optional(),
        assignmentReason: z.string().optional(),
      }),
      z.strictObject({
        type: z.literal("script"),
        language: ScriptLanguageSchema,
        command: z.string().min(1),
        outputMode: ScriptOutputModeSchema,
        assignmentReason: z.string().optional(),
      }),
    ]),
    inputs: z.array(SupportedInputSchema),
    outputs: z.array(SupportedOutputSchema),
  }),
});
const SupportedNodeSchema = CanvasExecutionNodeSchema.extend({
  type: z.literal("operation"),
  metaType: z.literal("operation").optional(),
  parentId: z.never().optional(),
  data: OperationNodeDataSchema.strict().extend({
    config: z.strictObject({}).optional(),
    agentId: z.never().optional(),
    agentRuntime: z.never().optional(),
    loopEnabled: z.literal(false).optional(),
    maxLoopCount: z.never().optional(),
    loopConditionPrompt: z.never().optional(),
  }),
});
const SupportedPipelineSchema = PipelineSchema.strict().extend({
  timeoutMs: z.null(),
  nodes: z.array(SupportedNodeSchema),
  edges: z.array(
    CanvasExecutionEdgeSchema.extend({
      data: z.strictObject({
        label: z.string().optional(),
        handoff: z.strictObject({
          kind: z.literal("handoff"),
          sourcePortId: z.string().min(1),
          targetPortId: z.string().min(1),
        }),
      }),
    }),
  ),
});

/**
 * Converts only referenced operations and explicitly bound scalar-value DAGs.
 * Authoring annotations (labels, notes, port descriptions, tags, timestamps,
 * status, assignmentReason and meta) remain in the original editing document.
 * No graph inputs/outputs are invented from unconnected ports. No I/O occurs.
 * The caller owns CAS publication: supplied revisions are never inferred heads.
 */
export const convertCanvasDraftToExecution = ({
  pipeline,
  operations,
  operationRevisions,
  externalInputs,
}: {
  pipeline: PipelineData;
  operations: readonly Operation[];
  operationRevisions: Readonly<Record<string, number>>;
  externalInputs?: { ports: ExecutionPortDefinition[]; edges: RuntimeEdge[] };
}): CanvasExecutionConversion => {
  const diagnostics: CanvasExecutionDiagnostic[] = [];
  const reportIssues = (
    issues: readonly z.core.$ZodIssue[],
    prefix: (string | number)[],
    operationId?: string,
  ) => {
    for (const issue of issues) {
      const paths =
        issue.code === "unrecognized_keys"
          ? issue.keys.map((key) => [...issue.path, key])
          : [issue.path];
      for (const path of paths) {
        const fullPath = [
          ...prefix,
          ...path.map((part) => (typeof part === "number" ? part : String(part))),
        ];
        const nodeIndex =
          fullPath[0] === "pipeline" && fullPath[1] === "nodes" ? fullPath[2] : undefined;
        diagnostics.push({
          code: prefix[0] === "definition" ? "invalid_definition" : "unsupported_contract",
          message: issue.message,
          path: fullPath,
          ...(typeof nodeIndex === "number" ? { nodeId: pipeline.nodes[nodeIndex]?.id } : {}),
          ...(operationId ? { operationId } : {}),
        });
      }
    }
  };
  const draft = SupportedPipelineSchema.safeParse(pipeline);
  if (!draft.success) {
    reportIssues(draft.error.issues, ["pipeline"]);

    return { success: false, diagnostics };
  }
  const converted = new Map<string, OperationRevision>();
  draft.data.nodes.forEach((node, nodeIndex) => {
    const operationId = node.data.operationId;
    if (converted.has(operationId)) return;
    const matches = operations.filter((operation) => operation.id === operationId);
    if (matches.length !== 1) {
      diagnostics.push({
        code: "missing_operation",
        message: "Exactly one source Operation must match this node.",
        path: ["pipeline", "nodes", nodeIndex, "data", "operationId"],
        nodeId: node.id,
        operationId,
      });

      return;
    }
    const revision = Object.hasOwn(operationRevisions, operationId)
      ? operationRevisions[operationId]
      : undefined;
    if (!Number.isSafeInteger(revision) || (revision ?? 0) < 1) {
      diagnostics.push({
        code: "missing_revision",
        message: "An explicit positive Operation revision binding is required.",
        path: ["operationRevisions", operationId],
        nodeId: node.id,
        operationId,
      });

      return;
    }
    const original = matches[0]!;
    const index = operations.indexOf(original);
    if (original.config.executor?.type === "script" && !original.config.executor.outputMode) {
      diagnostics.push({
        code: "unsupported_contract",
        message:
          "The authoring Script contract has no explicit outputMode. Declare a v2 output contract before publishing; stdout and output ports are not used to guess it.",
        path: ["operations", index, "config", "executor", "outputMode"],
        nodeId: node.id,
        operationId,
      });

      return;
    }
    const operation = SupportedOperationSchema.safeParse(original);
    if (!operation.success) {
      reportIssues(operation.error.issues, ["operations", index], operationId);

      return;
    }
    const { config } = operation.data;
    const candidate = OperationRevisionSchema.safeParse({
      apiVersion: 2,
      id: operationId,
      revision,
      name: operation.data.name,
      description: operation.data.description,
      inputPorts: config.inputs.map((port) => ({
        id: port.id,
        valueType: port.accepts[0] === "application/json" ? "json" : "text",
        // Same default as pipeline-engine/handoff/validateHandoffGraph.
        cardinality: port.cardinality ?? "one",
        required: port.required,
      })),
      outputPorts: config.outputs.map((port) => ({
        id: port.id,
        valueType: port.contentType === "json" ? "json" : "text",
        cardinality: port.cardinality,
        required: port.required,
      })),
      executor:
        config.executor.type === "script"
          ? {
              kind: "script",
              language: config.executor.language,
              source: config.executor.command,
              outputMode: config.executor.outputMode,
            }
          : {
              kind: "agent",
              instruction: config.executor.prompt,
              systemPrompt: config.executor.systemPrompt,
              allowedTools: [],
            },
      executionDefaults:
        config.executor.type === "agent" && config.executor.model
          ? { model: config.executor.model }
          : {},
      capabilityRefs: [],
    });
    if (candidate.success) converted.set(operationId, candidate.data);
    else reportIssues(candidate.error.issues, ["operations", index], operationId);
  });
  if (diagnostics.length > 0) return { success: false, diagnostics };

  const nodeById = new Map(draft.data.nodes.map((node) => [node.id, node]));
  const edges: RuntimeEdge[] = [...(externalInputs?.edges ?? [])];
  const incoming = new Map<string, number>();
  for (const [index, edge] of (externalInputs?.edges ?? []).entries()) {
    const sourcePortId = edge.source.kind === "input" ? edge.source.portId : undefined;
    const source = externalInputs?.ports.find((port) => port.id === sourcePortId);
    const targetNode = nodeById.get(edge.target.nodeId);
    const target = targetNode
      ? converted
          .get(targetNode.data.operationId)
          ?.inputPorts.find((port) => port.id === edge.target.portId)
      : undefined;
    const key = JSON.stringify([edge.target.nodeId, edge.target.portId]);
    if (
      !source ||
      !target ||
      source.valueType !== target.valueType ||
      source.cardinality !== target.cardinality ||
      incoming.has(key)
    )
      diagnostics.push({
        code: "invalid_binding",
        path: ["externalInputs", "edges", index],
        nodeId: edge.target.nodeId,
        message: "Input binding must explicitly match the target port type and cardinality.",
      });
    incoming.set(key, 1);
  }
  draft.data.edges.forEach((edge, index) => {
    const { sourcePortId, targetPortId } = edge.data.handoff;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    const output =
      sourceNode &&
      converted
        .get(sourceNode.data.operationId)
        ?.outputPorts.find((port) => port.id === sourcePortId);
    const input =
      targetNode &&
      converted
        .get(targetNode.data.operationId)
        ?.inputPorts.find((port) => port.id === targetPortId);
    if (
      !output ||
      !input ||
      output.valueType !== input.valueType ||
      output.cardinality !== input.cardinality
    ) {
      diagnostics.push({
        code: "invalid_binding",
        message:
          "Explicit source/target ports must exist and have matching value types and cardinalities.",
        path: ["pipeline", "edges", index, "data", "handoff"],
        nodeId: edge.target,
      });

      return;
    }
    const key = JSON.stringify([edge.target, targetPortId]);
    incoming.set(key, (incoming.get(key) ?? 0) + 1);
    if (incoming.get(key)! > 1) {
      diagnostics.push({
        code: "invalid_binding",
        message:
          "Multiple incoming bindings require an explicit order; the authoring contract does not provide one.",
        path: ["pipeline", "edges", index],
        nodeId: edge.target,
      });

      return;
    }
    edges.push({
      id: edge.id,
      source: { kind: "node", nodeId: edge.source, portId: sourcePortId },
      target: { nodeId: edge.target, portId: targetPortId },
      order: 0,
    });
  });
  draft.data.nodes.forEach((node, index) => {
    converted.get(node.data.operationId)!.inputPorts.forEach((port) => {
      if (port.required && !incoming.has(JSON.stringify([node.id, port.id]))) {
        diagnostics.push({
          code: "invalid_binding",
          message: "Required input has no explicit binding; graph inputs are not inferred.",
          path: ["pipeline", "nodes", index, "data", "operationId"],
          nodeId: node.id,
          operationId: node.data.operationId,
        });
      }
    });
  });
  if (diagnostics.length > 0) return { success: false, diagnostics };
  const definition = PipelineDefinitionContentSchema.safeParse({
    name: pipeline.name,
    description: pipeline.description,
    sharedContext: pipeline.sharedContext,
    graph: {
      schemaVersion: 2,
      inputs: externalInputs?.ports ?? [],
      outputs: [],
      edges,
      nodes: draft.data.nodes.map((node) => ({
        id: node.id,
        operation: {
          operationId: node.data.operationId,
          revision: converted.get(node.data.operationId)!.revision,
        },
        checkpoint: node.data.checkpoint ?? false,
        executionOverrides: node.data.executionOverrides ?? {},
      })),
    },
    editor: {
      schemaVersion: 2,
      nodePositions: Object.fromEntries(draft.data.nodes.map((node) => [node.id, node.position])),
      groups: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
  });
  if (!definition.success) {
    reportIssues(definition.error.issues, ["definition"]);

    return { success: false, diagnostics };
  }

  return {
    success: true,
    operations: [...converted.values()],
    definition: definition.data,
    diagnostics: [],
  };
};
