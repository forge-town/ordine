import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { PanelRightOpen } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ResizeHandle } from "../../../components/ResizeHandle";
import {
  MAX_AGENT_PANEL_WIDTH,
  MIN_AGENT_PANEL_WIDTH,
  selectSelectedNode,
  useCanvasPageStore,
} from "../_store";
import { CanvasFlow } from "../CanvasFlow";
import { CanvasContextMenu } from "../CanvasContextMenu";
import { CanvasEdgeInspector } from "../CanvasEdgeInspector";
import { ConnectionMenu } from "../ConnectionMenu";
import { NodeContextMenu } from "../NodeContextMenu";
import { RunConsole } from "../RunConsole";
import { CanvasAgentControlPanel } from "../AgentControlBridge";
import { LlmContentCard } from "../LlmContentCard/LlmContentCard";
import { CanvasEmptyState } from "../CanvasEmptyState";
import { CanvasNodeCreationPalette } from "../CanvasNodeCreationPalette";
import { CanvasSettingsDrawer } from "../CanvasSettingsDrawer";
import { CanvasTopChrome } from "../CanvasTopChrome";
import { CanvasToolbar } from "../CanvasToolbar";
import { CanvasMiniSidebar } from "../CanvasMiniSidebar";
import { CanvasComponentPanel } from "../CanvasComponentPanel";
import { CanvasNodePropertiesPanel } from "../CanvasNodePropertiesPanel";
import { CanvasWorkspaceSidebarOverlay } from "../CanvasWorkspaceSidebarOverlay";
import { getScreenViewportCenter, getViewportRectCenter } from "../utils/nodePosition";

const AGENT_PANEL_COLLAPSE_AT = 248;

export const CanvasInner = ({
  showCanvasMiniSidebar = true,
}: {
  onGeneratedPipeline?: (pipelineId: string) => Promise<void> | void;
  showCanvasMiniSidebar?: boolean;
}) => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const flowViewportRef = useRef<HTMLDivElement>(null);
  const agentPanelShellRef = useRef<HTMLDivElement>(null);
  const agentPanelResizeStartWidthRef = useRef(0);

  const contextMenu = useStore(store, (state) => state.contextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const isQuickAddOpen = useStore(store, (state) => state.isQuickAddOpen);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const agentPanelWidth = useStore(store, (state) => state.agentPanelWidth);
  const setAgentPanelWidth = useStore(store, (state) => state.setAgentPanelWidth);
  const toggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const nodes = useStore(store, (state) => state.nodes);
  const sidebarPanel = useStore(store, (state) => state.sidebarPanel);
  const selectedNode = useStore(store, selectSelectedNode);
  const showPropertiesPanel = sidebarPanel === "properties" && !!selectedNode;

  const getFlowViewportScreenCenter = useCallback(() => {
    const rect = flowViewportRef.current?.getBoundingClientRect();

    return rect ? getViewportRectCenter(rect) : getScreenViewportCenter();
  }, []);

  const handleAgentPanelDelta = useCallback(
    (delta: number) => {
      const nextWidth = agentPanelResizeStartWidthRef.current + delta;
      if (nextWidth < AGENT_PANEL_COLLAPSE_AT) {
        toggleAgentPanel();

        return;
      }
      setAgentPanelWidth(nextWidth);
    },
    [setAgentPanelWidth, toggleAgentPanel],
  );
  const handleToggleAgentPanel = toggleAgentPanel;
  const handleAgentPanelDragStart = () => {
    const renderedWidth = agentPanelShellRef.current?.getBoundingClientRect().width ?? 0;
    agentPanelResizeStartWidthRef.current = renderedWidth || agentPanelWidth;
  };

  return (
    <div
      className="canvas-container relative flex h-full min-h-0 w-full overflow-hidden bg-background"
      data-testid="canvas-langflow-shell"
    >
      {showCanvasMiniSidebar && <CanvasMiniSidebar />}

      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <main
            className={cn(
              "relative min-w-0 flex-1 overflow-hidden",
              agentPanelIsOpen && "max-[1180px]:z-40",
            )}
          >
            <CanvasComponentPanel getCreateNodeScreenPosition={getFlowViewportScreenCenter} />
            {showPropertiesPanel && <CanvasNodePropertiesPanel />}
            <CanvasToolbar />
            <CanvasFlow viewportRef={flowViewportRef} />

            {nodes.length === 0 && <CanvasEmptyState />}

            {isQuickAddOpen && (
              <CanvasNodeCreationPalette
                getCreateNodeScreenPosition={getFlowViewportScreenCenter}
              />
            )}

            {contextMenu && <CanvasContextMenu />}

            {connectionMenu && <ConnectionMenu />}

            <CanvasEdgeInspector />

            {nodeContextMenu && <NodeContextMenu />}

            <LlmContentCard />

            {isConsoleOpen && <RunConsole />}
          </main>
        </div>
      </div>

      <CanvasTopChrome />

      {agentPanelIsOpen ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-0 right-0 top-16 z-40 flex justify-end min-[1181px]:static min-[1181px]:inset-y-0 min-[1181px]:z-auto min-[1181px]:h-full min-[1181px]:w-auto min-[1181px]:shrink-0 min-[1181px]:self-stretch",
            showCanvasMiniSidebar ? "w-[calc(100%_-_3.5rem)] max-[480px]:!w-full" : "w-full",
          )}
          data-testid="canvas-agent-panel-region-wrapper"
        >
          <div
            className="pointer-events-none flex w-px shrink-0 justify-center min-[1181px]:h-full min-[1181px]:w-1.5"
            data-testid="canvas-agent-panel-resize-gutter"
          >
            <ResizeHandle
              ariaLabel={t("canvas.agentPanel.resize")}
              line={false}
              max={MAX_AGENT_PANEL_WIDTH}
              min={MIN_AGENT_PANEL_WIDTH}
              side="right"
              value={agentPanelWidth}
              onCollapse={handleToggleAgentPanel}
              onDelta={handleAgentPanelDelta}
              onDragStart={handleAgentPanelDragStart}
            />
          </div>
          <div
            className="pointer-events-none min-h-0 min-w-0 overflow-hidden max-[480px]:flex-1 min-[1181px]:h-full min-[1181px]:shrink-0 min-[1181px]:py-1.5 min-[1181px]:pr-1.5"
            data-testid="canvas-agent-panel-region"
          >
            <div
              ref={agentPanelShellRef}
              className="pointer-events-auto h-full min-h-0 min-w-0 w-full shrink overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong max-[480px]:!w-full"
              data-testid="canvas-agent-panel-shell"
              style={{ width: `${agentPanelWidth}px`, maxWidth: "100%" }}
            >
              <CanvasAgentControlPanel />
            </div>
          </div>
        </div>
      ) : (
        <button
          aria-label={t("canvas.agentPanel.reopen")}
          className="absolute bottom-0 right-0 top-16 z-30 flex w-12 shrink-0 items-center justify-center border-l border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground min-[1181px]:static min-[1181px]:inset-y-0 min-[1181px]:z-auto"
          data-testid="canvas-agent-panel-reopen"
          title={t("canvas.agentPanel.reopen")}
          type="button"
          onClick={handleToggleAgentPanel}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      <CanvasSettingsDrawer />
      <CanvasWorkspaceSidebarOverlay />
    </div>
  );
};
