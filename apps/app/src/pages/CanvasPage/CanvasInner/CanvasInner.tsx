import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Button } from "@repo/ui/button";
import { selectSelectedNode, useCanvasPageStore } from "../_store";
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
import { EdgeInspector } from "../EdgeInspector";
import { NodeConfig } from "../NodeConfig";
import { getScreenViewportCenter, getViewportRectCenter } from "../utils/nodePosition";

export const CanvasInner = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const flowViewportRef = useRef<HTMLDivElement>(null);
  const sidebarResizeStateRef = useRef<{ startClientX: number; startWidth: number } | null>(null);

  const contextMenu = useStore(store, (state) => state.contextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const isQuickAddOpen = useStore(store, (state) => state.isQuickAddOpen);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const nodes = useStore(store, (state) => state.nodes);
  const sidebarPanel = useStore(store, (state) => state.sidebarPanel);
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const workspacePanelWidth = useStore(store, (state) => state.workspacePanelWidth);
  const setWorkspacePanelWidth = useStore(store, (state) => state.setWorkspacePanelWidth);
  const selectedNode = useStore(store, selectSelectedNode);
  const configNodeId = useStore(store, (state) => state.configNodeId);
  const configNode = nodes.find((node) => node.id === configNodeId);
  const showNodeConfig =
    configNode?.data.nodeType === "operation" || configNode?.data.nodeType === "prompt";
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

  return (
    <div
      className="flex h-full min-h-0 w-full overflow-hidden bg-background"
      data-testid="canvas-langflow-shell"
    >
      <CanvasMiniSidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CanvasTopChrome />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {isSidebarOpen && (
            <div className="relative shrink-0">
              <aside
                className="h-full shrink-0 border-r bg-background"
                data-testid="canvas-work-panel"
                style={{ width: `${workspacePanelWidth}px` }}
              >
                {showNodeConfig ? (
                  <NodeConfig />
                ) : showPropertiesPanel ? (
                  <CanvasNodePropertiesPanel />
                ) : (
                  <CanvasComponentPanel getCreateNodeScreenPosition={getFlowViewportScreenCenter} />
                )}
              </aside>
              <Button
                aria-label={t("canvas.operationsPanel.resize", {
                  defaultValue: "Resize operations panel",
                })}
                className="absolute inset-y-0 -right-2 z-10 h-full w-4 cursor-col-resize rounded-none px-0 touch-none"
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

            <EdgeInspector />

            {isConsoleOpen && <RunConsole />}

            {agentPanelIsOpen && <AgentPanel />}
          </main>
        </div>
      </div>

      <CanvasSettingsDrawer />
      <CanvasWorkspaceSidebarOverlay />
    </div>
  );
};
