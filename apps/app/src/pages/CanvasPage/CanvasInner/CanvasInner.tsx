import { useCallback, useRef } from "react";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
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

  const getFlowViewportScreenCenter = useCallback(() => {
    const rect = flowViewportRef.current?.getBoundingClientRect();

    return rect ? getViewportRectCenter(rect) : getScreenViewportCenter();
  }, []);

  return (
    <div className="relative h-full w-full">
      <CanvasTopChrome />

      <CanvasFlow viewportRef={flowViewportRef} />

      {nodes.length === 0 && <CanvasEmptyState />}

      {isQuickAddOpen && (
        <CanvasNodeCreationPalette getCreateNodeScreenPosition={getFlowViewportScreenCenter} />
      )}

      <CanvasStatusBar />

      <CanvasSettingsDrawer />

      {contextMenu && <CanvasContextMenu />}

      {connectionMenu && <ConnectionMenu />}

      {nodeContextMenu && <NodeContextMenu />}

      <LlmContentCard />

      {isConsoleOpen && <RunConsole />}

      {agentPanelIsOpen && <AgentPanel />}
    </div>
  );
};
