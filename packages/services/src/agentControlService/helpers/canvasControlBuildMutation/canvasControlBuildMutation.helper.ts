import {
  AddNodeInputSchema,
  ConnectNodesInputSchema,
  DisconnectEdgeInputSchema,
  ReconnectEdgeInputSchema,
  RemoveNodeInputSchema,
  UpdateNodeInputSchema,
} from "@repo/agent-control";

import {
  PipelineNodeDataSchema,
  type PipelineAction,
  type PipelineGraphSnapshot,
} from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import type { CanvasMutationToolName, CanvasMutationInput } from "../../contracts";
import type { CanvasControlError } from "../canvasControl";
import { canvasError } from "../canvasControlCanvasError";

export const buildMutation = (
  toolName: CanvasMutationToolName,
  input: CanvasMutationInput,
  snapshot: PipelineGraphSnapshot,
  actionId: string,
): Result<{ action: PipelineAction; inverse: PipelineAction[] }, CanvasControlError> => {
  if (toolName === "ordine.add_node") {
    const parsed = AddNodeInputSchema.parse(input);

    return ok({
      action: { type: "addNode", node: parsed.node },
      inverse: [{ type: "removeNode", nodeId: parsed.node.id }],
    });
  }
  if (toolName === "ordine.remove_node") {
    const parsed = RemoveNodeInputSchema.parse(input);
    const node = snapshot.nodes.find((entry) => entry.id === parsed.nodeId);
    if (!node) {
      return err(
        canvasError(actionId, "NODE_NOT_FOUND", `Node "${parsed.nodeId}" was not found.`, true, {
          nodeId: parsed.nodeId,
        }),
      );
    }
    const incidentEdges = snapshot.edges.filter(
      (edge) => edge.source === parsed.nodeId || edge.target === parsed.nodeId,
    );

    return ok({
      action: { type: "removeNode", nodeId: parsed.nodeId },
      inverse: [
        { type: "addNode", node },
        ...incidentEdges.map((edge) => ({ type: "addEdge" as const, edge })),
      ],
    });
  }
  if (toolName === "ordine.connect_nodes") {
    const parsed = ConnectNodesInputSchema.parse(input);

    return ok({
      action: {
        type: "addEdge",
        edge: {
          id: parsed.edgeId,
          source: parsed.source,
          target: parsed.target,
          sourceHandle:
            snapshot.nodes.find((node) => node.id === parsed.source)?.data.nodeType === "operation"
              ? `output:${parsed.data.handoff.sourcePortId}`
              : parsed.data.handoff.sourcePortId,
          targetHandle:
            snapshot.nodes.find((node) => node.id === parsed.target)?.data.nodeType === "operation"
              ? `input:${parsed.data.handoff.targetPortId}`
              : parsed.data.handoff.targetPortId,
          data: parsed.data,
        },
      },
      inverse: [{ type: "removeEdge", edgeId: parsed.edgeId }],
    });
  }
  if (toolName === "ordine.disconnect_edge") {
    const parsed = DisconnectEdgeInputSchema.parse(input);
    const edge = snapshot.edges.find((entry) => entry.id === parsed.edgeId);
    if (!edge) {
      return err(
        canvasError(actionId, "EDGE_NOT_FOUND", `Edge "${parsed.edgeId}" was not found.`, true),
      );
    }

    return ok({
      action: { type: "removeEdge", edgeId: parsed.edgeId },
      inverse: [{ type: "addEdge", edge }],
    });
  }
  if (toolName === "ordine.reconnect_edge") {
    const parsed = ReconnectEdgeInputSchema.parse(input);
    const edge = snapshot.edges.find((entry) => entry.id === parsed.edgeId);
    if (!edge) {
      return err(
        canvasError(actionId, "EDGE_NOT_FOUND", `Edge "${parsed.edgeId}" was not found.`, true),
      );
    }

    return ok({
      action: {
        type: "reconnectEdge",
        edgeId: parsed.edgeId,
        source: parsed.source,
        target: parsed.target,
        sourceHandle:
          snapshot.nodes.find((node) => node.id === parsed.source)?.data.nodeType === "operation"
            ? `output:${parsed.data.handoff.sourcePortId}`
            : parsed.data.handoff.sourcePortId,
        targetHandle:
          snapshot.nodes.find((node) => node.id === parsed.target)?.data.nodeType === "operation"
            ? `input:${parsed.data.handoff.targetPortId}`
            : parsed.data.handoff.targetPortId,
        data: parsed.data,
      },
      inverse: [
        {
          type: "reconnectEdge",
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        },
      ],
    });
  }

  const parsed = UpdateNodeInputSchema.parse(input);
  const node = snapshot.nodes.find((entry) => entry.id === parsed.nodeId);
  if (!node) {
    return err(
      canvasError(actionId, "NODE_NOT_FOUND", `Node "${parsed.nodeId}" was not found.`, true, {
        nodeId: parsed.nodeId,
      }),
    );
  }
  const patch =
    "data" in parsed.patch && Object.keys(parsed.patch).length === 1
      ? parsed.patch.data
      : parsed.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return err(
      canvasError(
        actionId,
        "INVALID_NODE_PATCH",
        "update_node.patch must contain node data fields or a single data object.",
        true,
        { field: "patch" },
      ),
    );
  }
  const nextData = PipelineNodeDataSchema.safeParse({
    ...node.data,
    ...(patch as Record<string, unknown>),
  });
  if (!nextData.success) {
    const issue = nextData.error.issues[0];

    return err(
      canvasError(
        actionId,
        "INVALID_NODE_DATA",
        issue?.message ?? "The node data patch is invalid.",
        true,
        {
          field: issue?.path.length ? `patch.${issue.path.join(".")}` : "patch",
          nodeId: parsed.nodeId,
        },
      ),
    );
  }

  return ok({
    action: { type: "replaceNodeData", nodeId: parsed.nodeId, data: nextData.data },
    inverse: [{ type: "replaceNodeData", nodeId: parsed.nodeId, data: node.data }],
  });
};
