import { useStore } from "zustand";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useHarnessCanvasStore } from "./_store";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { CanvasFlow } from "./components/CanvasFlow";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { ConnectionMenu } from "./components/ConnectionMenu";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { CanvasFloatingMenu } from "./components/CanvasFloatingMenu";
import { AiAssistantPanel } from "./components/AiAssistantPanel";

const CanvasInner = () => {
  const store = useHarnessCanvasStore();

  const pipelineName = useStore(store, (state) => state.pipelineName);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const handleCloseContextMenu = useStore(
    store,
    (state) => state.closeContextMenu,
  );
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const handleCloseConnectionMenu = useStore(
    store,
    (state) => state.closeConnectionMenu,
  );
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const handleCloseNodeContextMenu = useStore(
    store,
    (state) => state.closeNodeContextMenu,
  );

  return (
    <div className="relative h-full w-full">
      <CanvasFloatingMenu />

      <div className="pointer-events-none absolute left-16 right-4 top-4 z-40 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-700">
            {pipelineName || "无标题 Pipeline"}
          </span>
        </div>
      </div>

      <CanvasToolbar />

      <CanvasFlow />

      {contextMenu && (
        <CanvasContextMenu
          flowX={contextMenu.flowX}
          flowY={contextMenu.flowY}
          screenX={contextMenu.screenX}
          screenY={contextMenu.screenY}
          onClose={handleCloseContextMenu}
        />
      )}

      {connectionMenu && (
        <ConnectionMenu
          flowX={connectionMenu.flowX}
          flowY={connectionMenu.flowY}
          screenX={connectionMenu.screenX}
          screenY={connectionMenu.screenY}
          onClose={handleCloseConnectionMenu}
        />
      )}

      {nodeContextMenu && (
        <NodeContextMenu
          nodeId={nodeContextMenu.nodeId}
          screenX={nodeContextMenu.screenX}
          screenY={nodeContextMenu.screenY}
          onClose={handleCloseNodeContextMenu}
        />
      )}

      <AiAssistantPanel />
    </div>
  );
};

export const CanvasPageContent = () => {
  return (
    <div className="h-full w-full overflow-hidden">
      <ReactFlowProvider>
        <CanvasInner />
      </ReactFlowProvider>
    </div>
  );
};
