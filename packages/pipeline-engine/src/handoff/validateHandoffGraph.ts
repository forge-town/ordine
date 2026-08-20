import {
  mediaTypeMatches,
  OperationConfigSchema,
  type InputPort,
  type OperationConfig,
  type OutputItem,
  type PipelineEdge,
  type PipelineNode,
} from "@repo/schemas";
import type { OperationInfo } from "../schemas";

export type HandoffGraphIssue = {
  edgeId: string;
  message: string;
};

const portId = (port: InputPort | OutputItem): string => port.id ?? port.name;

const findOutputPort = (config: OperationConfig, id: string): OutputItem | undefined =>
  config.outputs.find((port) => portId(port) === id);

const findInputPort = (config: OperationConfig, id: string): InputPort | undefined =>
  config.inputs.find((port) => portId(port) === id);

const getOperationConfig = (operation: OperationInfo): OperationConfig | undefined => {
  const parsed = OperationConfigSchema.safeParse(operation.config);

  return parsed.success ? parsed.data : undefined;
};

/**
 * Checks only edges that explicitly declare a file handoff. Legacy graph edges
 * keep their current pass-through behavior until an editor binds semantic ports.
 */
export const validateHandoffGraph = ({
  nodes,
  edges,
  operations,
}: {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  operations: Map<string, OperationInfo>;
}): HandoffGraphIssue[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const boundEdges = edges.filter((edge) => edge.data?.handoff !== undefined);
  const issues: HandoffGraphIssue[] = [];
  const boundIncomingByTargetPort = new Map<string, number>();

  for (const edge of boundEdges) {
    const binding = edge.data?.handoff;
    if (!binding) continue;

    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (sourceNode?.data.nodeType !== "operation" || targetNode?.data.nodeType !== "operation") {
      issues.push({
        edgeId: edge.id,
        message:
          "A file handoff must connect one Operation output port to one Operation input port.",
      });
      continue;
    }

    const sourceOperation = operations.get(sourceNode.data.operationId);
    const targetOperation = operations.get(targetNode.data.operationId);
    if (!sourceOperation || !targetOperation) {
      issues.push({
        edgeId: edge.id,
        message: "A file handoff references an Operation that is not available to this run.",
      });
      continue;
    }

    const sourceConfig = getOperationConfig(sourceOperation);
    const targetConfig = getOperationConfig(targetOperation);
    if (!sourceConfig || !targetConfig) {
      issues.push({
        edgeId: edge.id,
        message: "A file handoff references an Operation with an invalid configuration.",
      });
      continue;
    }

    const output = findOutputPort(sourceConfig, binding.sourcePortId);
    const input = findInputPort(targetConfig, binding.targetPortId);
    if (!output || !input) {
      issues.push({
        edgeId: edge.id,
        message: `Handoff ports must exist: ${binding.sourcePortId} → ${binding.targetPortId}.`,
      });
      continue;
    }
    if (!output.produces?.length || !input.accepts?.length) {
      issues.push({
        edgeId: edge.id,
        message: `Handoff ports must declare MIME types: ${binding.sourcePortId} → ${binding.targetPortId}.`,
      });
      continue;
    }
    if (
      !output.produces.some((produced) =>
        input.accepts?.some((accepted) => mediaTypeMatches(accepted, produced)),
      )
    ) {
      issues.push({
        edgeId: edge.id,
        message: `Handoff MIME types are incompatible: ${binding.sourcePortId} → ${binding.targetPortId}. Add a conversion Operation.`,
      });
      continue;
    }

    const targetKey = `${edge.target}:${binding.targetPortId}`;
    const incomingCount = (boundIncomingByTargetPort.get(targetKey) ?? 0) + 1;
    boundIncomingByTargetPort.set(targetKey, incomingCount);
    if ((input.cardinality ?? "one") === "one" && incomingCount > 1) {
      issues.push({
        edgeId: edge.id,
        message: `Input port ${binding.targetPortId} accepts one handoff but has multiple incoming edges.`,
      });
    }
  }

  return issues;
};
