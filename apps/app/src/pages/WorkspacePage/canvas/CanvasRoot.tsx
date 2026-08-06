import "@xyflow/react/dist/style.css";
import { ReactFlowProvider } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { PipelineData } from "@repo/schemas";
import { fromPipelineSnapshot } from "./_store/canvasTypes";
import { CanvasStoreProvider } from "./_store/canvasStore";
import { EdgeInspector } from "./panels/EdgeInspector";
import { NodeConfig } from "./panels/NodeConfig";
import { CanvasFlow } from "./flow";
import { CanvasEmptyState } from "./CanvasEmptyState";

export type CanvasRootProps = {
  pipeline: Pick<PipelineData, "edges" | "id" | "nodes">;
};

export const CanvasRoot = ({ pipeline }: CanvasRootProps) => {
  const { i18n } = useTranslation();
  const snapshot = fromPipelineSnapshot({
    edges: pipeline.edges,
    nodes: pipeline.nodes,
  });

  return (
    <ReactFlowProvider>
      <CanvasStoreProvider edges={snapshot.edges} nodes={snapshot.nodes}>
        <div
          className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:24px_24px]"
          data-testid="canvas-v2-root"
          lang={i18n.language}
        >
          <CanvasFlow />
          <EdgeInspector pipelineId={pipeline.id} />
          <NodeConfig pipelineId={pipeline.id} />
          <CanvasEmptyState />
        </div>
      </CanvasStoreProvider>
    </ReactFlowProvider>
  );
};
