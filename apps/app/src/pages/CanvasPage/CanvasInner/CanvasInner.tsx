import { useCallback, useRef } from "react";
import { useStore } from "zustand";
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
import { getScreenViewportCenter, getViewportRectCenter } from "../utils/nodePosition";

export const CanvasInner = () => {
  const store = useCanvasPageStore();
  const flowViewportRef = useRef<HTMLDivElement>(null);

  const contextMenu = useStore(store, (state) => state.contextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const isQuickAddOpen = useStore(store, (state) => state.isQuickAddOpen);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const nodes = useStore(store, (state) => state.nodes);
  const sidebarPanel = useStore(store, (state) => state.sidebarPanel);
  const isSidebarOpen = useStore(store, (state) => state.isSidebarOpen);
  const selectedNode = useStore(store, selectSelectedNode);
  const showPropertiesPanel = sidebarPanel === "properties" && !!selectedNode;

  const getFlowViewportScreenCenter = useCallback(() => {
    const rect = flowViewportRef.current?.getBoundingClientRect();

    return rect ? getViewportRectCenter(rect) : getScreenViewportCenter();
  }, []);

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
            <aside
              className="h-full w-[min(22rem,28vw)] min-w-72 shrink-0 border-r bg-background"
              data-testid="canvas-work-panel"
            >
              {showPropertiesPanel ? (
                <CanvasNodePropertiesPanel />
              ) : (
                <CanvasComponentPanel getCreateNodeScreenPosition={getFlowViewportScreenCenter} />
              )}
            </aside>
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

            {agentPanelIsOpen && <AgentPanel />}
          </main>
        </div>
      </div>

      <CanvasSettingsDrawer />
      <CanvasWorkspaceSidebarOverlay />
    </div>
  );
};
