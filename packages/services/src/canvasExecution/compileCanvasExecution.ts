import { z } from "zod/v4";
import { CanvasExecutionNodeSchema, CanvasExecutionEdgeSchema } from "./canvasAuthoringSchema";
import { Result } from "neverthrow";
import {
  ExecutionArtifactNameSchema,
  ExecutionPortDefinitionSchema,
  ExecutionPortValuesSchema,
  PromptObjectNodeDataSchema,
  LocalPathOutputNodeDataSchema,
  OperationRevisionSchema,
  PipelineDefinitionContentSchema,
  PipelineSchema,
  type Operation,
  type PipelineData,
  type RuntimeEdge,
  type ExecutionPortDefinition,
} from "@repo/schemas";
import {
  canvasOutputMimeTypes,
  convertCanvasDraftToExecution,
  type CanvasExecutionConversion,
  type CanvasExecutionDiagnostic,
} from "./convertCanvasDraftToExecution";

const isManagedOutput = (node: PipelineData["nodes"][number]) =>
  node.data.nodeType === "output-local-path" && node.data.storage === "artifact";
const outputOperationId = (nodeId: string) => `output:${nodeId}`;
const promptPortId = (nodeId: string) => `input-${nodeId}`;

export const getCanvasExecutionInputs = (pipeline: PipelineData) =>
  ExecutionPortValuesSchema.parse(
    Object.fromEntries(
      pipeline.nodes.flatMap((node) => {
        if (node.data.nodeType !== "prompt") return [];
        const value =
          node.data.valueType === "json"
            ? { kind: "json", value: JSON.parse(node.data.prompt) as unknown }
            : { kind: "text", value: node.data.prompt };

        return [[promptPortId(node.id), [value]]];
      }),
    ),
  );

export const getCanvasExecutionOperationIds = (pipeline: PipelineData) => [
  ...new Set(
    pipeline.nodes.flatMap((node) =>
      node.data.nodeType === "operation"
        ? [node.data.operationId]
        : isManagedOutput(node)
          ? [outputOperationId(node.id)]
          : [],
    ),
  ),
];

const ManagedOutputSchema = CanvasExecutionNodeSchema.extend({
  type: z.literal("output-local-path"),
  parentId: z.never().optional(),
  data: LocalPathOutputNodeDataSchema.strict().extend({
    storage: z.literal("artifact"),
    localPath: z.literal(""),
    outputFileName: ExecutionArtifactNameSchema,
    outputMode: z.never().optional(),
  }),
});
const OutputEdgeSchema = CanvasExecutionEdgeSchema.extend({
  data: z.strictObject({
    label: z.string().optional(),
    handoff: z.strictObject({
      kind: z.literal("handoff"),
      sourcePortId: z.string().min(1),
      targetPortId: z.literal("input"),
    }),
  }),
});
const PromptInputSchema = CanvasExecutionNodeSchema.extend({
  type: z.literal("prompt"),
  parentId: z.never().optional(),
  data: PromptObjectNodeDataSchema.strict(),
});
const PromptEdgeSchema = CanvasExecutionEdgeSchema.extend({
  data: z.strictObject({
    label: z.string().optional(),
    handoff: z.strictObject({
      kind: z.literal("handoff"),
      sourcePortId: z.literal("output"),
      targetPortId: z.string().min(1),
    }),
  }),
});

/** An explicit managed-file output becomes a normal immutable write_artifact step. */
export const compileCanvasExecution = (input: {
  pipeline: PipelineData;
  operations: readonly Operation[];
  operationRevisions: Readonly<Record<string, number>>;
}): CanvasExecutionConversion => {
  const { pipeline, operations, operationRevisions } = input;
  if (!PipelineSchema.strict().safeParse(pipeline).success || pipeline.timeoutMs !== null)
    return {
      success: false,
      diagnostics: [
        {
          code: "unsupported_contract",
          path: ["pipeline"],
          message: "流程字段无效，或运行时限尚未显式转交到运行请求。",
        },
      ],
    };
  const managed = pipeline.nodes.filter(isManagedOutput);
  const prompts = pipeline.nodes.filter((node) => node.data.nodeType === "prompt");
  if (managed.length === 0 && prompts.length === 0) return convertCanvasDraftToExecution(input);
  const diagnostics: CanvasExecutionDiagnostic[] = [];
  if (new Set(pipeline.nodes.map((node) => node.id)).size !== pipeline.nodes.length)
    return {
      success: false,
      diagnostics: [
        {
          code: "invalid_definition",
          message: "Node identifiers must be unique.",
          path: ["pipeline", "nodes"],
        },
      ],
    };
  const outputIds = new Set(managed.map((node) => node.id));
  const promptIds = new Set(prompts.map((node) => node.id));
  const externalPorts: ExecutionPortDefinition[] = [];
  const externalEdges: RuntimeEdge[] = [];
  for (const node of prompts) {
    const parsed = PromptInputSchema.safeParse(node);
    if (!parsed.success) {
      diagnostics.push({
        code: "invalid_definition",
        nodeId: node.id,
        path: ["pipeline", "nodes", pipeline.nodes.indexOf(node)],
        message: "文本输入包含不支持的字段或分组语义。",
      });
      continue;
    }
    const port = ExecutionPortDefinitionSchema.safeParse({
      id: promptPortId(node.id),
      valueType: parsed.data.data.valueType ?? "text",
      cardinality: "one",
      required: true,
    });
    if (!port.success) {
      diagnostics.push({
        code: "invalid_definition",
        nodeId: node.id,
        path: ["pipeline", "nodes", pipeline.nodes.indexOf(node), "id"],
        message: "输入节点 ID 不能形成稳定的执行端口。",
      });
      continue;
    }
    externalPorts.push(port.data);
    for (const edge of pipeline.edges.filter(
      (edge) => edge.source === node.id && !outputIds.has(edge.target),
    )) {
      const binding = PromptEdgeSchema.safeParse(edge);
      if (!binding.success) {
        diagnostics.push({
          code: "invalid_binding",
          nodeId: node.id,
          path: ["pipeline", "edges", pipeline.edges.indexOf(edge)],
          message: "文本输入必须明确连接 output 到目标端口。",
        });
        continue;
      }
      externalEdges.push({
        id: edge.id,
        source: { kind: "input", portId: port.data.id },
        target: { nodeId: edge.target, portId: binding.data.data.handoff.targetPortId },
        order: 0,
      });
    }
  }
  const values = Result.fromThrowable(
    () => getCanvasExecutionInputs(pipeline),
    () => new Error("输入内容不符合 text/json 契约，请检查 JSON 格式和大小。"),
  )();
  if (values.isErr())
    diagnostics.push({
      code: "invalid_definition",
      path: ["pipeline", "nodes"],
      message: values.error.message,
    });
  if (diagnostics.length > 0) return { success: false, diagnostics };
  const baseNodes = pipeline.nodes.filter(
    (node) => !isManagedOutput(node) && !promptIds.has(node.id),
  );
  const baseEdges = pipeline.edges.filter(
    (edge) => !outputIds.has(edge.target) && !promptIds.has(edge.source),
  );
  const base: CanvasExecutionConversion =
    baseNodes.length === 0 &&
    baseEdges.length === 0 &&
    externalEdges.length === 0 &&
    managed.length > 0
      ? {
          success: true,
          operations: [],
          diagnostics: [],
          definition: {
            name: pipeline.name,
            description: pipeline.description,
            sharedContext: pipeline.sharedContext,
            graph: { schemaVersion: 2, inputs: externalPorts, nodes: [], edges: [], outputs: [] },
            editor: {
              schemaVersion: 2,
              nodePositions: {},
              groups: [],
              viewport: { x: 0, y: 0, zoom: 1 },
            },
          },
        }
      : convertCanvasDraftToExecution({
          ...input,
          pipeline: { ...pipeline, nodes: baseNodes, edges: baseEdges },
          externalInputs: { ports: externalPorts, edges: externalEdges },
        });
  if (!base.success) return base;
  const definition = structuredClone(base.definition);
  const compiledOperations = [...base.operations];
  for (const [index, node] of managed.entries()) {
    const parsed = ManagedOutputSchema.safeParse(node);
    const incoming = pipeline.edges.filter((edge) => edge.target === node.id);
    const edge = OutputEdgeSchema.safeParse(incoming[0]);
    const revision = Object.hasOwn(operationRevisions, outputOperationId(node.id))
      ? operationRevisions[outputOperationId(node.id)]
      : undefined;
    if (
      !parsed.success ||
      incoming.length !== 1 ||
      !edge.success ||
      !Number.isSafeInteger(revision) ||
      revision! < 1
    ) {
      diagnostics.push({
        code: "invalid_binding",
        nodeId: node.id,
        path: ["pipeline", "nodes", pipeline.nodes.indexOf(node)],
        message:
          "运行产物需要文件名、一个明确连接到 input 的输入，以及固定修订；不能携带目录写入策略。",
      });
      continue;
    }
    const sourceNode = pipeline.nodes.find((candidate) => candidate.id === edge.data.source);
    const sourceOperationId =
      sourceNode?.data.nodeType === "operation" ? sourceNode.data.operationId : undefined;
    const sourceOperation = base.operations.find((operation) => operation.id === sourceOperationId);
    const sourcePort =
      sourceNode?.data.nodeType === "prompt" && edge.data.data.handoff.sourcePortId === "output"
        ? externalPorts.find((port) => port.id === promptPortId(sourceNode.id))
        : sourceOperation?.outputPorts.find(
            (port) => port.id === edge.data.data.handoff.sourcePortId,
          );
    const sourceDraft = operations.find((operation) => operation.id === sourceOperation?.id);
    const sourceOutput = sourceDraft?.config.outputs.find((port) => port.id === sourcePort?.id);
    if (
      !sourcePort ||
      sourcePort.cardinality !== "one" ||
      sourcePort.valueType === "artifact" ||
      (!sourceOutput && sourceNode?.data.nodeType !== "prompt") ||
      compiledOperations.some((operation) => operation.id === outputOperationId(node.id))
    ) {
      diagnostics.push({
        code: "invalid_binding",
        nodeId: node.id,
        path: ["pipeline", "edges", pipeline.edges.indexOf(incoming[0]!)],
        message: "运行产物必须明确连接一个 text/json 输出，且输出步骤 ID 不能与 Operation 重复。",
      });
      continue;
    }
    const mimeType = sourceOutput
      ? (sourceOutput.produces?.[0] ?? canvasOutputMimeTypes[sourceOutput.contentType][0]!)
      : sourcePort.valueType === "json"
        ? "application/json"
        : "text/plain";
    const writer = OperationRevisionSchema.safeParse({
      apiVersion: 2,
      id: outputOperationId(node.id),
      revision,
      name: node.data.label,
      inputPorts: [
        { id: "input", valueType: sourcePort.valueType, cardinality: "one", required: true },
      ],
      outputPorts: [
        {
          id: "file",
          valueType: "artifact",
          cardinality: "one",
          required: true,
          mimeTypes: [mimeType],
        },
      ],
      executor: {
        kind: "builtin",
        name: "write_artifact",
        config: { name: parsed.data.data.outputFileName, mimeType },
      },
    });
    if (!writer.success) {
      diagnostics.push({
        code: "invalid_definition",
        nodeId: node.id,
        path: ["pipeline", "nodes", pipeline.nodes.indexOf(node)],
        message: writer.error.message,
      });
      continue;
    }
    compiledOperations.push(writer.data);
    definition.graph.nodes.push({
      id: node.id,
      operation: { operationId: writer.data.id, revision: writer.data.revision },
      executionOverrides: {},
      failurePolicy: "required",
      retry: { maxAttempts: 1, retryableCodes: [] },
      checkpoint: false,
    });
    definition.graph.edges.push({
      id: edge.data.id,
      source:
        sourceNode?.data.nodeType === "prompt"
          ? { kind: "input", portId: sourcePort.id }
          : { kind: "node", nodeId: edge.data.source, portId: sourcePort.id },
      target: { nodeId: node.id, portId: "input" },
      order: 0,
    });
    definition.graph.outputs.push({
      port: { ...writer.data.outputPorts[0]!, id: `file_${index + 1}` },
      source: { nodeId: node.id, portId: "file" },
    });
    definition.editor.nodePositions[node.id] = node.position;
  }
  if (diagnostics.length > 0) return { success: false, diagnostics };
  const verified = PipelineDefinitionContentSchema.safeParse(definition);
  if (!verified.success)
    return {
      success: false,
      diagnostics: [
        { code: "invalid_definition", path: ["definition"], message: verified.error.message },
      ],
    };

  return {
    success: true,
    operations: compiledOperations,
    definition: verified.data,
    diagnostics: [],
  };
};
