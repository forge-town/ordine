import { useCallback } from "react";
import { useStore } from "zustand";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { SkillPalette } from "./SkillPalette";
import { CanvasToolbar } from "./CanvasToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { HarnessCanvasHeader } from "./HarnessCanvasHeader";

const nodeTypes = {
  input: InputNode,
  skill: SkillNode,
  condition: ConditionNode,
  output: OutputNode,
} as const;

const CanvasInner = () => {
  const store = useHarnessCanvasStore();
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const selectedEdgeId = useStore(store, (state) => state.selectedEdgeId);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      store.getState().selectNode(node.id);
      store.getState().openPropertiesPanel();
    },
    [store],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      store.getState().selectEdge(edge.id);
      store.getState().openPropertiesPanel();
    },
    [store],
  );

  const handlePaneClick = useCallback(() => {
    store.getState().selectNode(null);
    store.getState().selectEdge(null);
    store.getState().closePropertiesPanel();
  }, [store]);

  return (
    <div className="relative h-full w-full">
      <CanvasToolbar
        onFitView={() => fitView({ padding: 0.1 })}
        onZoomIn={() => zoomIn()}
        onZoomOut={() => zoomOut()}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={store.getState().onNodesChange}
        onEdgesChange={store.getState().onEdgesChange}
        onConnect={store.getState().onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: false }}
        className="bg-gray-50"
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#d1d5db"
        />
        <Controls
          position="bottom-left"
          showInteractive
          className="border-gray-200! bg-white! shadow-sm!"
        />
        <MiniMap
          position="bottom-right"
          nodeColor={(node) => {
            const typeColorMap: Record<string, string> = {
              input: "#10b981",
              skill: "#7c3aed",
              condition: "#f59e0b",
              output: "#0ea5e9",
            };
            return typeColorMap[node.type ?? ""] ?? "#94a3b8";
          }}
          className="border-gray-200! bg-white! shadow-sm!"
        />
      </ReactFlow>

      <PropertiesPanel />
      <AiAssistantPanel />
    </div>
  );
};

export const HarnessCanvasPageContent = () => {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <HarnessCanvasHeader />

      <div className="flex flex-1 overflow-hidden">
        <SkillPalette />

        <div className="relative flex-1 overflow-hidden">
          <ReactFlowProvider>
            <CanvasInner />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
};
