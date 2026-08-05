import { useCanvasStore } from "../../_store/canvasStore";
import { NodeConfigDialog } from "./NodeConfigDialog";

export type NodeConfigProps = {
  pipelineId: string;
};

export const NodeConfig = ({ pipelineId }: NodeConfigProps) => {
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const node = useCanvasStore((state) =>
    state.nodes.find((item) => item.id === state.configNodeId),
  );

  if (!configNodeId || !node) {
    return null;
  }

  return <NodeConfigDialog key={node.id} node={node} pipelineId={pipelineId} />;
};
