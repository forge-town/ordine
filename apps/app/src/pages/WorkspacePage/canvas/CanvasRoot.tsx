import { ReactFlowProvider } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { PipelineData } from "@repo/schemas";
import { fromPipelineSnapshot } from "./_store/canvasTypes";
import { CanvasStoreProvider } from "./_store/canvasStore";
import { CanvasFlow } from "./flow";
import { CanvasEmptyState } from "./CanvasEmptyState";
import { CanvasToolbar, ComponentPanel, TopPill } from "./chrome";
import { EdgeInspector } from "./panels/EdgeInspector";
import { NodeConfig } from "./panels/NodeConfig";

export type CanvasRootProps = {
  pipeline: Pick<PipelineData, "edges" | "id" | "name" | "nodes" | "version">;
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
          <TopPill
            pipeline={{ id: pipeline.id, name: pipeline.name, version: pipeline.version }}
          />
          <CanvasToolbar />
          <ComponentPanel />
          <EdgeInspector pipelineId={pipeline.id} />
          <NodeConfig pipelineId={pipeline.id} />
          <CanvasEmptyState />
        </div>
      </CanvasStoreProvider>
    </ReactFlowProvider>
  );
};
