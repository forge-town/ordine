import { useEffect } from "react";
import { useStore } from "zustand";
import { PanelRightOpen } from "lucide-react";
import { CanvasPageContent } from "@/pages/CanvasPage/CanvasPageContent";
import { CanvasPageStoreProvider, useCanvasPageStore } from "@/pages/CanvasPage/_store";
import { AgentBar } from "./AgentBar";
import { useWorkspaceStore } from "./_store/workspaceStore";

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

export const WorkspacePage = ({ pipelineId }: WorkspacePageProps) => {
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const toggleAgentOpen = useWorkspaceStore((state) => state.toggleAgentOpen);
  const handleAgentBarToggle = () => {
    toggleAgentOpen();
  };

  return (
    <div className="flex min-h-0 flex-1 bg-background">
      <main className="min-w-0 flex-1 overflow-hidden">
        <CanvasPageStoreProvider
          pipeline={{ edges: [], id: pipelineId, name: `Pipeline ${pipelineId}`, nodes: [] }}
        >
          <WorkspaceCanvasPhaseBridge />
          <CanvasPageContent />
        </CanvasPageStoreProvider>
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
  );
};
