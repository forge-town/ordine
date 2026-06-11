import { useEffect } from "react";
import { useOne } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PipelineData } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { AgentBar } from "./AgentBar";
import { CanvasRoot } from "./canvas";
import { CanvasStoreProvider, useCanvasStore } from "./canvas/_store/canvasStore";
import { derivePhase } from "./canvas/_store/derivePhase";
import { fromPipelineSnapshot } from "./canvas/_store/canvasTypes";
import { WorkspaceStoreProvider, useWorkspaceStore } from "./_store/workspaceStore";

export type WorkspacePageProps = {
  pipelineId: string;
};

/**
 * Phase is derived from facts (graph, proposal, jobs) — never set by business
 * code. Transient conversational phases (clarify / reversing) are kept until a
 * stronger derived phase (proposal / running / done) takes over.
 */
const WorkspacePhaseSync = () => {
  const nodes = useCanvasStore((state) => state.nodes);
  const pendingProposal = useCanvasStore((state) => state.pendingProposal);
  const activeJob = useCanvasStore((state) => state.activeJob);
  const latestJob = useCanvasStore((state) => state.latestJob);
  const phase = useWorkspaceStore((state) => state.phase);
  const setPhase = useWorkspaceStore((state) => state.setPhase);

  useEffect(() => {
    const derived = derivePhase({ activeJob, latestJob, nodes, pendingProposal });
    const transient = phase === "clarify" || phase === "reversing";
    if (transient && (derived === "empty" || derived === "applied")) {
      return;
    }
    if (derived !== phase) {
      setPhase(derived);
    }
  }, [activeJob, latestJob, nodes, pendingProposal, phase, setPhase]);

  return null;
};

const WorkspacePageContent = ({ pipelineId }: WorkspacePageProps) => {
  const { t } = useTranslation();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const toggleAgentOpen = useWorkspaceStore((state) => state.toggleAgentOpen);

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
        {t("workspace.notFoundPipeline")}
      </div>
    );
  }

  const snapshot = fromPipelineSnapshot({
    edges: pipelineResult.edges,
    nodes: pipelineResult.nodes,
  });

  return (
    <ReactFlowProvider>
      <CanvasStoreProvider edges={snapshot.edges} nodes={snapshot.nodes}>
        <WorkspacePhaseSync />
        <div className="flex h-full min-h-0 bg-background">
          <main className="min-w-0 flex-1 overflow-hidden">
            <CanvasRoot pipeline={pipelineResult} />
          </main>

          {agentOpen ? (
            <div className="w-[360px] shrink-0 border-l border-border">
              <AgentBar
                pipelineId={pipelineId}
                pipelineName={pipelineResult.name}
                onCollapse={toggleAgentOpen}
              />
            </div>
          ) : (
            <button
              aria-label={t("workspace.agentBar.reopen")}
              className="flex w-12 shrink-0 items-center justify-center border-l border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
              type="button"
              onClick={toggleAgentOpen}
            >
              <PanelRightOpen className="h-4 w-4" />
            </button>
          )}
        </div>
      </CanvasStoreProvider>
    </ReactFlowProvider>
  );
};

export const WorkspacePage = ({ pipelineId }: WorkspacePageProps) => (
  <WorkspaceStoreProvider pipelineId={pipelineId}>
    <WorkspacePageContent pipelineId={pipelineId} />
  </WorkspaceStoreProvider>
);
