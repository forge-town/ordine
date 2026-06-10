import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";

export type NodeConfigPatch = Record<string, unknown>;

export interface NodeConfigSectionProps {
  node: PipelineNode;
  edges: PipelineEdge[];
  onPatch: (patch: NodeConfigPatch) => void;
}
