import { useEffect } from "react";
import { useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { PanelRightOpen } from "lucide-react";
import type { PipelineData } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { CanvasPageContent } from "@/pages/CanvasPage/CanvasPageContent";
import { CanvasPageStoreProvider, useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { AgentBar } from "./AgentBar";
import { WorkspaceStoreProvider, useWorkspaceStore } from "./_store/workspaceStore";

export type WorkspacePageProps = {
  pipelineId: string;
};

const WorkspaceCanvasPhaseBridge = () => {
  const store = useCanvasPageStore();
  const phase = useWorkspaceStore((state) => state.phase);
  const setWorkspacePhase = useStore(store, (state) => state.setWorkspacePhase);

  useEffect(() => {
    setWorkspacePhase(phase);
  }, [phase, setWorkspacePhase]);

  return null;
};

const WorkspacePageContent = ({ pipelineId }: WorkspacePageProps) => {
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const toggleAgentOpen = useWorkspaceStore((state) => state.toggleAgentOpen);
  const handleAgentBarToggle = () => {
    toggleAgentOpen();
  };

  if (pipelineQuery?.isLoading) {
    return (
      <div className="grid h-full place-items-center bg-background">
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!pipelineResult) {
    return (
      <div className="grid h-full place-items-center bg-background text-sm text-muted-foreground">
        Pipeline not found
      </div>
    );
  }

  return (
    <CanvasPageStoreProvider pipeline={pipelineResult}>
      <div className="flex h-full min-h-0 bg-background">
        <main className="min-w-0 flex-1 overflow-hidden">
          <WorkspaceCanvasPhaseBridge />
          <CanvasPageContent />
        </main>

        {agentOpen ? (
          <div className="w-[360px] shrink-0 border-l border-border">
            <AgentBar pipelineId={pipelineId} onCollapse={handleAgentBarToggle} />
          </div>
        ) : (
          <button
            aria-label="Open Agent Bar"
            className="flex w-12 shrink-0 items-center justify-center border-l border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
            type="button"
            onClick={handleAgentBarToggle}
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </CanvasPageStoreProvider>
  );
};

export const WorkspacePage = ({ pipelineId }: WorkspacePageProps) => (
  <WorkspaceStoreProvider pipelineId={pipelineId}>
    <WorkspacePageContent pipelineId={pipelineId} />
  </WorkspaceStoreProvider>
);
