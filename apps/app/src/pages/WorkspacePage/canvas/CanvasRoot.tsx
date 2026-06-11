import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import type { PipelineData } from "@repo/schemas";
import { CanvasFlow } from "./flow";
import { CanvasEmptyState } from "./CanvasEmptyState";
import { CanvasToolbar, ComponentPanel, TopPill } from "./chrome";
import { AskComposer } from "./ask";
import { CanvasRefSync } from "./refs";
import { CheckpointDialog, RunConsole, RunPoller } from "./run";
import { ComposeBar, DrillHint } from "./compose";
import { EdgeInspector } from "./panels/EdgeInspector";
import { NodeConfig } from "./panels/NodeConfig";

export type CanvasRootProps = {
  pipeline: Pick<PipelineData, "id" | "name" | "version">;
};

/**
 * Canvas V2 stage. Expects to be rendered inside ReactFlowProvider and
 * CanvasStoreProvider (owned by WorkspacePage, shared with the Agent Bar).
 */
export const CanvasRoot = ({ pipeline }: CanvasRootProps) => {
  const { i18n } = useTranslation();

  return (
    <div
      className="relative h-full min-h-0 w-full overflow-hidden bg-[radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:24px_24px]"
      data-testid="canvas-v2-root"
      lang={i18n.language}
    >
      <CanvasFlow />
      <TopPill pipeline={{ id: pipeline.id, name: pipeline.name, version: pipeline.version }} />
      <CanvasToolbar />
      <ComponentPanel />
      <AskComposer />
      <ComposeBar pipelineId={pipeline.id} />
      <DrillHint />
      <EdgeInspector pipelineId={pipeline.id} />
      <NodeConfig pipelineId={pipeline.id} />
      <CanvasRefSync />
      <RunPoller />
      <RunConsole />
      <CheckpointDialog />
      <CanvasEmptyState />
    </div>
  );
};
