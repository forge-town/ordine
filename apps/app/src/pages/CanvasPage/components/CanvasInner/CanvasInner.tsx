import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../../_store";
import { CanvasToolbar } from "../CanvasToolbar";
import { CanvasFlow } from "../CanvasFlow";
import { CanvasContextMenu } from "../CanvasContextMenu";
import { ConnectionMenu } from "../ConnectionMenu";
import { NodeContextMenu } from "../NodeContextMenu";
import { CanvasFloatingMenu } from "../CanvasFloatingMenu";
import { AiAssistantPanel } from "../AiAssistantPanel";
import { RunConsole } from "../RunConsole";
import { LlmContentCard } from "../LlmContentCard/LlmContentCard";

export const CanvasInner = () => {
  const store = useHarnessCanvasStore();

  const pipelineName = useStore(store, (state) => state.pipelineName);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const handleCloseContextMenu = useStore(store, (state) => state.closeContextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const handleCloseConnectionMenu = useStore(store, (state) => state.closeConnectionMenu);
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const handleCloseNodeContextMenu = useStore(store, (state) => state.closeNodeContextMenu);
  const activeJobId = useStore(store, (state) => state.activeJobId);
  const isConsoleOpen = useStore(store, (state) => state.isConsoleOpen);
  const handleCloseConsole = useStore(store, (state) => state.handleCloseConsole);
  const setPipelineName = useStore(store, (state) => state.setPipelineName);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPipelineName(e.target.value);
  };

  return (
    <div className="relative h-full w-full">
      <CanvasFloatingMenu />

      <div className="pointer-events-none absolute left-16 right-4 top-4 z-40 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-sm">
          <input
            className="w-48 bg-transparent text-sm font-medium text-gray-700 outline-none placeholder:text-gray-400"
            placeholder="无标题 Pipeline"
            value={pipelineName}
            onChange={handleNameChange}
          />
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

      <LlmContentCard />

      {isConsoleOpen && <RunConsole jobId={activeJobId} onClose={handleCloseConsole} />}
    </div>
  );
};
