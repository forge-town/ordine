import { useState } from "react";
import { useStore } from "zustand";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNotification } from "@refinedev/core";

import { useHarnessCanvasStore } from "./_store";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { CanvasFlow } from "./components/CanvasFlow";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { ConnectionMenu } from "./components/ConnectionMenu";
import { NodeContextMenu } from "./components/NodeContextMenu";
import { CanvasFloatingMenu } from "./components/CanvasFloatingMenu";
import { updatePipeline } from "@/services/pipelinesService";

const handleExport = () => {
  // TODO: 实现导出功能
  console.log("export");
};

const CanvasInner = () => {
  const store = useHarnessCanvasStore();

  // 使用浅比较选择器，避免不必要重渲染
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const contextMenu = useStore(store, (state) => state.contextMenu);
  const closeContextMenu = useStore(store, (state) => state.closeContextMenu);
  const connectionMenu = useStore(store, (state) => state.connectionMenu);
  const closeConnectionMenu = useStore(
    store,
    (state) => state.closeConnectionMenu,
  );
  const nodeContextMenu = useStore(store, (state) => state.nodeContextMenu);
  const closeNodeContextMenu = useStore(
    store,
    (state) => state.closeNodeContextMenu,
  );

  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { open: openNotification } = useNotification();

  const handleUndo = () => store.getState().undo();
  const handleRedo = () => store.getState().redo();

  const [saveState, setSaveState] = useState<"idle" | "saving">("idle");

  const handleSave = async () => {
    if (!pipelineId) return;
    setSaveState("saving");
    try {
      await updatePipeline({
        data: {
          id: pipelineId,
          patch: {
            nodes: nodes as unknown[],
            edges: edges as unknown[],
            updatedAt: Date.now(),
          },
        },
      });
      openNotification?.({
        type: "success",
        message: "保存成功",
        description: `Pipeline「${pipelineName || "无标题"}」已保存`,
      });
    } catch {
      openNotification?.({
        type: "error",
        message: "保存失败",
        description: "请稍后重试",
      });
    } finally {
      setSaveState("idle");
    }
  };

  return (
    <div className="relative h-full w-full">
      <CanvasFloatingMenu
        onSave={pipelineId ? handleSave : undefined}
        onExport={handleExport}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="pointer-events-none absolute left-16 right-4 top-4 z-40 flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-700">
            {pipelineName || "无标题 Pipeline"}
          </span>
          {saveState === "saving" && (
            <span className="text-xs text-gray-500">保存中...</span>
          )}
        </div>
      </div>

      <CanvasToolbar
        onFitView={() => fitView({ padding: 0.1 })}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
      />

      <CanvasFlow />

      {contextMenu && (
        <CanvasContextMenu
          screenX={contextMenu.screenX}
          screenY={contextMenu.screenY}
          flowX={contextMenu.flowX}
          flowY={contextMenu.flowY}
          onClose={closeContextMenu}
        />
      )}

      {connectionMenu && (
        <ConnectionMenu
          screenX={connectionMenu.screenX}
          screenY={connectionMenu.screenY}
          flowX={connectionMenu.flowX}
          flowY={connectionMenu.flowY}
          onClose={closeConnectionMenu}
        />
      )}

      {nodeContextMenu && (
        <NodeContextMenu
          screenX={nodeContextMenu.screenX}
          screenY={nodeContextMenu.screenY}
          nodeId={nodeContextMenu.nodeId}
          onClose={closeNodeContextMenu}
        />
      )}
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
