import { useEffect, useRef, useState } from "react";
import { useOne } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { PanelRightOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PipelineData } from "@repo/schemas";
import { PageLoadingState } from "@/components/PageLoadingState";
import { ResizeHandle } from "@/components/ResizeHandle";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { AgentBar } from "./AgentBar";
import { AnchorCountSync } from "./AnchorCountSync";
import { CanvasRoot } from "./canvas";
import { CanvasStoreProvider, useCanvasStore } from "./canvas/_store/canvasStore";
import { derivePhase } from "./canvas/_store/derivePhase";
import { fromPipelineSnapshot } from "./canvas/_store/canvasTypes";
import { WorkspaceStoreProvider, useWorkspaceStore } from "./_store/workspaceStore";
import { AgentBarStoreProvider } from "./AgentBar/_store";

export type WorkspacePageProps = {
  pipelineId: string;
};

const AGENT_BAR_WIDTH_KEY = "ordine.agentBarWidth";
const AGENT_BAR_MIN = 300;
const AGENT_BAR_MAX = 520;
const AGENT_BAR_COLLAPSE_AT = 248;
const AGENT_BAR_DEFAULT = 360;

const loadAgentBarWidth = (): number => {
  const raw = globalThis.localStorage?.getItem(AGENT_BAR_WIDTH_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;

  return Number.isFinite(parsed)
    ? Math.min(AGENT_BAR_MAX, Math.max(AGENT_BAR_MIN, parsed))
    : AGENT_BAR_DEFAULT;
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

const PENDING_FOCUS_NODE_KEY = "ordine.pendingFocusNode";

/** Consumes a node focus handed off from global search (sessionStorage). */
const PendingFocusConsumer = ({ pipelineId }: { pipelineId: string }) => {
  const nodes = useCanvasStore((state) => state.nodes);
  const focusRef = useWorkspaceStore((state) => state.focusRef);

  useEffect(() => {
    const raw = globalThis.sessionStorage?.getItem(PENDING_FOCUS_NODE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as { nodeId?: string; pipelineId?: string };
    if (parsed.pipelineId !== pipelineId) {
      return;
    }
    const node = nodes.find((item) => item.id === parsed.nodeId);
    if (!node) {
      return;
    }
    globalThis.sessionStorage?.removeItem(PENDING_FOCUS_NODE_KEY);
    focusRef({
      baseId: node.id,
      id: node.id,
      kind: node.type ?? "node",
      label: node.data.label,
      path: [],
      type: "node",
    });
  }, [focusRef, nodes, pipelineId]);

  return null;
};

const WorkspacePageContent = ({ pipelineId }: WorkspacePageProps) => {
  const { t } = useTranslation();
  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const setAgentOpen = useWorkspaceStore((state) => state.setAgentOpen);
  const toggleAgentOpen = useWorkspaceStore((state) => state.toggleAgentOpen);
  const [agentBarWidth, setAgentBarWidth] = useState(loadAgentBarWidth);
  const dragStartWidth = useRef(agentBarWidth);

  const handleAgentBarDelta = (delta: number) => {
    const next = dragStartWidth.current + delta;
    if (next < AGENT_BAR_COLLAPSE_AT) {
      setAgentOpen(false);

      return;
    }
    const clamped = Math.min(AGENT_BAR_MAX, Math.max(AGENT_BAR_MIN, next));
    setAgentBarWidth(clamped);
    globalThis.localStorage?.setItem(AGENT_BAR_WIDTH_KEY, String(clamped));
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
        <AnchorCountSync />
        <PendingFocusConsumer pipelineId={pipelineId} />
        <div className="flex h-full min-h-0 bg-background">
          <main className="min-w-0 flex-1 overflow-hidden">
            <CanvasRoot pipeline={pipelineResult} />
          </main>

          {agentOpen ? (
            <ResizeHandle
              line={false}
              side="right"
              onCollapse={() => setAgentOpen(false)}
              onDelta={handleAgentBarDelta}
              onDragStart={() => {
                dragStartWidth.current = agentBarWidth;
              }}
            />
          ) : null}
          {agentOpen ? (
            <div
              className="h-full shrink-0 overflow-hidden py-1.5 pr-1.5"
              data-testid="agent-bar-panel"
              style={{ width: agentBarWidth }}
            >
              <div className="h-full w-full overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
                <AgentBar
                  pipelineId={pipelineId}
                  pipelineName={pipelineResult.name}
                  onCollapse={toggleAgentOpen}
                />
              </div>
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
    <AgentBarStoreProvider pipelineId={pipelineId}>
      <WorkspacePageContent pipelineId={pipelineId} />
    </AgentBarStoreProvider>
  </WorkspaceStoreProvider>
);
