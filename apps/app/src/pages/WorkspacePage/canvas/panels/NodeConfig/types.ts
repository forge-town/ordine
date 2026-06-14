import type { CanvasEdge, CanvasNode } from "../../_store/canvasTypes";

export type NodeConfigPatch = Record<string, unknown>;

export type NodeConfigSectionProps = {
  edges: CanvasEdge[];
  node: CanvasNode;
  onPatch: (patch: NodeConfigPatch) => void;
};
