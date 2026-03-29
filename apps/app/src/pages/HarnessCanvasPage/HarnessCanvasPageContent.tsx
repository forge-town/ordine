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
import { CanvasToolbar } from "./CanvasToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import { AiAssistantPanel } from "./AiAssistantPanel";
import { HarnessCanvasHeader } from "./HarnessCanvasHeader";
import { CanvasContextMenu } from "./CanvasContextMenu";

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

  const { fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();

  const [contextMenu, setContextMenu] = useState<{
    screenX: number;
    screenY: number;
    flowX: number;
    flowY: number;
  } | null>(null);

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
        onPaneContextMenu={handlePaneContextMenu}
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

export const HarnessCanvasPageContent = () => {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <HarnessCanvasHeader />

      <div className="relative flex-1 overflow-hidden">
        <ReactFlowProvider>
          <CanvasInner />
        </ReactFlowProvider>
      </div>
    </div>
  );
};
