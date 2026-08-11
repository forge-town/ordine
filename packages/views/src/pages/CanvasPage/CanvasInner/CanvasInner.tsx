import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { PanelRightOpen } from "lucide-react";
import { Button } from "@repo/ui/button";
import { ResizeHandle } from "../../../components/ResizeHandle";
import {
  MAX_AGENT_PANEL_WIDTH,
  MIN_AGENT_PANEL_WIDTH,
  selectSelectedNode,
  useCanvasPageStore,
} from "../_store";
import { CanvasFlow } from "../CanvasFlow";
import { CanvasContextMenu } from "../CanvasContextMenu";
import { ConnectionMenu } from "../ConnectionMenu";
import { NodeContextMenu } from "../NodeContextMenu";
import { RunConsole } from "../RunConsole";
import { AgentPanel } from "../AgentPanel";
import { LlmContentCard } from "../LlmContentCard/LlmContentCard";
import { CanvasEmptyState } from "../CanvasEmptyState";
import { CanvasNodeCreationPalette } from "../CanvasNodeCreationPalette";
import { CanvasStatusBar } from "../CanvasStatusBar";
import { CanvasSettingsDrawer } from "../CanvasSettingsDrawer";
import { CanvasTopChrome } from "../CanvasTopChrome";
import { CanvasMiniSidebar } from "../CanvasMiniSidebar";
import { CanvasComponentPanel } from "../CanvasComponentPanel";
import { CanvasNodePropertiesPanel } from "../CanvasNodePropertiesPanel";
import { CanvasWorkspaceSidebarOverlay } from "../CanvasWorkspaceSidebarOverlay";
import { getScreenViewportCenter, getViewportRectCenter } from "../utils/nodePosition";

const AGENT_PANEL_COLLAPSE_AT = 248;

export const CanvasInner = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const flowViewportRef = useRef<HTMLDivElement>(null);
  const agentPanelShellRef = useRef<HTMLDivElement>(null);
  const sidebarResizeStateRef = useRef<{ startClientX: number; startWidth: number } | null>(null);
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
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const workspacePanelWidth = useStore(store, (state) => state.workspacePanelWidth);
  const setWorkspacePanelWidth = useStore(store, (state) => state.setWorkspacePanelWidth);
  const selectedNode = useStore(store, selectSelectedNode);
  const showPropertiesPanel = sidebarPanel === "properties" && !!selectedNode;

  const getFlowViewportScreenCenter = useCallback(() => {
    const rect = flowViewportRef.current?.getBoundingClientRect();

    return rect ? getViewportRectCenter(rect) : getScreenViewportCenter();
  }, []);

  const stopSidebarResize = useCallback(() => {
    if (!sidebarResizeStateRef.current) {
      return;
    }

    sidebarResizeStateRef.current = null;
    document.body.style.removeProperty("cursor");
    document.body.style.removeProperty("user-select");
  }, []);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = sidebarResizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const delta = event.clientX - resizeState.startClientX;
      setWorkspacePanelWidth(resizeState.startWidth + delta);
    };

    const handleMouseUp = () => {
      stopSidebarResize();
    };

    globalThis.addEventListener("mousemove", handleMouseMove);
    globalThis.addEventListener("mouseup", handleMouseUp);

    return () => {
      globalThis.removeEventListener("mousemove", handleMouseMove);
      globalThis.removeEventListener("mouseup", handleMouseUp);
      stopSidebarResize();
    };
  }, [setWorkspacePanelWidth, stopSidebarResize]);

  const handleWorkspacePanelResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      sidebarResizeStateRef.current = {
        startClientX: event.clientX,
        startWidth: workspacePanelWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [workspacePanelWidth],
  );

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

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden bg-background"
      data-testid="canvas-langflow-shell"
    >
      <CanvasMiniSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CanvasTopChrome />

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {isSidebarOpen && (
            <div className="relative shrink-0 max-[981px]:pointer-events-auto max-[981px]:absolute max-[981px]:inset-y-0 max-[981px]:left-0 max-[981px]:z-30">
              <aside
                className="h-full shrink-0 border-r bg-background shadow-none max-[981px]:max-w-[calc(100vw-4rem)] max-[981px]:shadow-float"
                data-testid="canvas-work-panel"
                style={{ width: `${workspacePanelWidth}px` }}
              >
                {showPropertiesPanel ? (
                  <CanvasNodePropertiesPanel />
                ) : (
                  <CanvasComponentPanel getCreateNodeScreenPosition={getFlowViewportScreenCenter} />
                )}
              </aside>
              <Button
                aria-label={t("canvas.operationsPanel.resize", {
                  defaultValue: "Resize operations panel",
                })}
                className="absolute inset-y-0 -right-3 z-10 h-full w-6 cursor-col-resize touch-none rounded-none px-0 max-[981px]:hidden"
                data-testid="canvas-work-panel-resizer"
                size="icon"
                variant="ghost"
                onMouseDown={handleWorkspacePanelResizeStart}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors hover:bg-primary" />
              </Button>
            </div>
          )}

          <main className="relative min-w-0 flex-1 overflow-hidden">
            <CanvasFlow viewportRef={flowViewportRef} />

            {nodes.length === 0 && <CanvasEmptyState />}

            {isQuickAddOpen && (
              <CanvasNodeCreationPalette
                getCreateNodeScreenPosition={getFlowViewportScreenCenter}
              />
            )}

            <CanvasStatusBar />

            {contextMenu && <CanvasContextMenu />}

            {connectionMenu && <ConnectionMenu />}

            {nodeContextMenu && <NodeContextMenu />}

            <LlmContentCard />

            {isConsoleOpen && <RunConsole />}
          </main>
        </div>
      </div>

      {agentPanelIsOpen ? (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-40 flex w-[calc(100%_-_3.5rem)] justify-end min-[701px]:static min-[701px]:z-auto min-[701px]:w-auto min-[701px]:shrink-0 min-[701px]:self-stretch"
          data-testid="canvas-agent-panel-region"
        >
          <ResizeHandle
            ariaLabel={t("canvas.agentPanel.resize")}
            max={MAX_AGENT_PANEL_WIDTH}
            min={MIN_AGENT_PANEL_WIDTH}
            side="right"
            value={agentPanelWidth}
            onCollapse={toggleAgentPanel}
            onDelta={handleAgentPanelDelta}
            onDragStart={() => {
              const renderedWidth = agentPanelShellRef.current?.getBoundingClientRect().width ?? 0;
              agentPanelResizeStartWidthRef.current = renderedWidth || agentPanelWidth;
            }}
          />
          <div
            ref={agentPanelShellRef}
            className="pointer-events-auto min-h-0 min-w-0 shrink overflow-hidden border-l border-border bg-surface"
            data-testid="canvas-agent-panel-shell"
            style={{ width: `${agentPanelWidth}px`, maxWidth: "calc(100% - 1px)" }}
          >
            <AgentPanel />
          </div>
        </div>
      ) : (
        <button
          aria-label={t("canvas.agentPanel.reopen")}
          className="flex w-12 shrink-0 items-center justify-center border-l border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground max-[700px]:absolute max-[700px]:inset-y-0 max-[700px]:right-0 max-[700px]:z-30"
          data-testid="canvas-agent-panel-reopen"
          title={t("canvas.agentPanel.reopen")}
          type="button"
          onClick={toggleAgentPanel}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      )}

      <CanvasSettingsDrawer />
      <CanvasWorkspaceSidebarOverlay />
    </div>
  );
};
