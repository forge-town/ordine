import type { Connection } from "@xyflow/react";
import type { HandoffEdge } from "@repo/schemas";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";

export const semanticHandleId = (direction: "input" | "output", portId: string) =>
  `${direction}:${portId}`;
const portFromHandle = (direction: "input" | "output", handle: string | null | undefined) =>
  handle?.startsWith(`${direction}:`) ? handle.slice(direction.length + 1) || null : null;
export const handoffFromConnection = (
  connection: Connection,
  source: PipelineNode,
  target: PipelineNode,
): HandoffEdge | null => {
  const sourcePortId =
    portFromHandle("output", connection.sourceHandle) ??
    (source.type === "prompt" && !connection.sourceHandle ? "output" : null);
  const targetPortId =
    portFromHandle("input", connection.targetHandle) ??
    (target.type === "output-local-path" && !connection.targetHandle ? "input" : null);

  return sourcePortId && targetPortId ? { kind: "handoff", sourcePortId, targetPortId } : null;
};
export const semanticConnectedMask = (
  edges: PipelineEdge[],
  nodeId: string,
  ports: string[],
  direction: "input" | "output",
): number =>
  ports.reduce(
    (mask, portId, index) =>
      edges.some((edge) =>
        direction === "input"
          ? edge.target === nodeId && edge.data?.handoff?.targetPortId === portId
          : edge.source === nodeId && edge.data?.handoff?.sourcePortId === portId,
      )
        ? mask + 2 ** index
        : mask,
    0,
  );
