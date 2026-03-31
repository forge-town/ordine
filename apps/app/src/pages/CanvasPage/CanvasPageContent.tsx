import { useCallback, useState } from "react";
import { useStore } from "zustand";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useHarnessCanvasStore } from "./_store";
import { InputNode } from "./nodes/InputNode";
import { SkillNode } from "./nodes/SkillNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { OutputNode } from "./nodes/OutputNode";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { AiAssistantPanel } from "./components/AiAssistantPanel";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { CanvasFloatingMenu } from "./components/CanvasFloatingMenu";
import { updatePipeline } from "@/services/pipelinesService";

const nodeTypes = {
  input: InputNode,
  skill: SkillNode,
  condition: ConditionNode,
  output: OutputNode,
} as const;

const defaultEdgeOptions = {
  type: "smoothstep",
  animated: true,
  style: { stroke: "#94a3b8", strokeWidth: 2 },
};

// 全局处理器（不依赖组件状态）
const handleUndo = () => {
  // TODO: 实现撤销功能
  console.log("undo");
};

const handleRedo = () => {
  // TODO: 实现重做功能
  console.log("redo");
};

const handleExport = () => {
  // TODO: 实现导出功能
  console.log("export");
};

const CanvasInner = () => {
  const store = useHarnessCanvasStore();
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);

  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<{
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
  } | null>(null);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

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
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("idle");
    }
  };

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      store.getState().selectNode(node.id);
      store.getState().openPropertiesPanel();
      setContextMenu(null);
    },
    [store],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      store.getState().selectEdge(edge.id);
      store.getState().openPropertiesPanel();
      setContextMenu(null);
    },
    [store],
  );

  const handlePaneClick = useCallback(() => {
    store.getState().selectNode(null);
    store.getState().selectEdge(null);
    store.getState().closePropertiesPanel();
    setContextMenu(null);
  }, [store]);

  const handlePaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const clientX = "clientX" in e ? e.clientX : 0;
      const clientY = "clientY" in e ? e.clientY : 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setContextMenu({
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  return (
    <div className="relative h-full w-full">
      {/* 浮动菜单 */}
      <CanvasFloatingMenu
        onSave={pipelineId ? handleSave : undefined}
        onExport={handleExport}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* 顶部标题栏 */}
      <div className="absolute left-16 right-4 top-4 z-40 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/90 px-4 py-1.5 shadow-sm backdrop-blur-sm pointer-events-auto">
          <span className="text-sm font-medium text-gray-700">
            {pipelineName || "无标题 Pipeline"}
          </span>
          {saveState === "saving" && (
            <span className="text-xs text-gray-500">保存中...</span>
          )}
          {saveState === "saved" && (
            <span className="text-xs text-green-600">已保存</span>
          )}
        </div>
      </div>

      <CanvasToolbar
        onFitView={() => fitView({ padding: 0.1 })}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          store.getState().onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          store.getState().onEdgesChange(changes);
        }}
        onConnect={(connection) => {
          store.getState().onConnect(connection);
        }}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: false }}
        className="bg-slate-50/50"
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#cbd5e1"
        />
        <Controls
          position="bottom-left"
          showInteractive
          className="border-gray-200! bg-white! shadow-sm!"
        />
      </ReactFlow>

      <PropertiesPanel />
      <AiAssistantPanel />

      {contextMenu && (
        <CanvasContextMenu
          screenX={contextMenu.screenX}
          screenY={contextMenu.screenY}
          flowX={contextMenu.flowX}
          flowY={contextMenu.flowY}
          onClose={() => setContextMenu(null)}
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
