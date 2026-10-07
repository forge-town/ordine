import type { PipelineNode, PipelineAssetInputSlot } from "@repo/schemas";

export const toInputSlots = (nodes: PipelineNode[]): PipelineAssetInputSlot[] =>
  nodes
    .filter((node) => node.metaType === "object")
    .map((node) => ({
      nodeId: node.id,
      label: node.data.label,
      acceptTypes: [node.data.nodeType],
    }));
