import { useMemo, useRef } from "react";
import { useStore } from "zustand";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type OnConnectStart,
  type OnConnectEnd,
} from "@xyflow/react";
import type { PipelineNode, PipelineEdge } from "../_store/canvasSlice";
import { useHarnessCanvasStore } from "../_store";
import { InputNode } from "../nodes/InputNode";
import { SkillNode } from "../nodes/SkillNode";
import { ConditionNode } from "../nodes/ConditionNode";
import { OutputNode } from "../nodes/OutputNode";

export const CanvasFlow = () => {
  const store = useHarnessCanvasStore();
  // Suppress pane click that React Flow fires right after a connection drag-end
  const shouldIgnorePaneClick = useRef(false);

  // 使用浅比较选择器，避免不必要重渲染
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const onNodesChange = useStore(store, (state) => state.onNodesChange);
  const onEdgesChange = useStore(store, (state) => state.onEdgesChange);
  const onConnect = useStore(store, (state) => state.onConnect);
  const selectNode = useStore(store, (state) => state.selectNode);
  const selectEdge = useStore(store, (state) => state.selectEdge);
  const openPropertiesPanel = useStore(
    store,
    (state) => state.openPropertiesPanel,
  );
  const closePropertiesPanel = useStore(
    store,
    (state) => state.closePropertiesPanel,
  );
  const openContextMenu = useStore(store, (state) => state.openContextMenu);
  const closeContextMenu = useStore(store, (state) => state.closeContextMenu);
  const openConnectionMenu = useStore(
    store,
    (state) => state.openConnectionMenu,
  );
  const closeConnectionMenu = useStore(
    store,
    (state) => state.closeConnectionMenu,
  );
  const setConnectStart = useStore(store, (state) => state.setConnectStart);

  const { screenToFlowPosition } = useReactFlow();

  // 使用 useMemo 缓存 nodeTypes - React Flow 最佳实践
  const nodeTypes = useMemo(
    () => ({
      input: InputNode,
      skill: SkillNode,
      condition: ConditionNode,
      output: OutputNode,
    }),
    [],
  );

  // 使用 useMemo 缓存 defaultEdgeOptions
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "default" as const,
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }),
    [],
  );

  const handleNodesChange = (changes: Parameters<typeof onNodesChange>[0]) => {
    onNodesChange(changes);
  };

  const handleEdgesChange = (changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes);
  };

  const handleConnect = (connection: Parameters<typeof onConnect>[0]) => {
    onConnect(connection);
    // connectStart is cleared in handleConnectEnd via connectionState.isValid
  };

  const handleConnectStart: OnConnectStart = (_, params) => {
    // 记录连接开始状态
    if (!params.nodeId) return;
    setConnectStart({
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
      handleType: params.handleType ?? null,
    });
  };

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    // User connected to a valid handle — no menu needed
    if (connectionState.isValid === true) {
      setConnectStart(null);
      return;
    }

    // !isValid (null = empty space, false = invalid handle) — open connection menu
    // Use connectionState.fromNode directly (more reliable than stored connectStart)
    const fromNode = connectionState.fromNode;
    const fromHandle = connectionState.fromHandle;

    if (fromNode) {
      const { clientX, clientY } =
        "changedTouches" in event
          ? (event as TouchEvent).changedTouches[0]
          : (event as MouseEvent);

      // Re-set connectStart from live connectionState data
      setConnectStart({
        nodeId: fromNode.id,
        handleId: fromHandle?.id ?? null,
        handleType: fromHandle?.type ?? null,
      });

      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      openConnectionMenu({
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });

      // React Flow fires onPaneClick right after onConnectEnd — suppress it
      shouldIgnorePaneClick.current = true;
      setTimeout(() => {
        shouldIgnorePaneClick.current = false;
      }, 100);
      return;
    }

    setConnectStart(null);
  };

  const handleNodeClick = (_: React.MouseEvent, node: PipelineNode) => {
    selectNode(node.id);
    openPropertiesPanel();
    closeContextMenu();
    closeConnectionMenu();
    setConnectStart(null);
  };

  const handleEdgeClick = (_: React.MouseEvent, edge: PipelineEdge) => {
    selectEdge(edge.id);
    openPropertiesPanel();
    closeContextMenu();
    closeConnectionMenu();
    setConnectStart(null);
  };

  const handlePaneClick = () => {
    if (shouldIgnorePaneClick.current) return;
    selectNode(null);
    selectEdge(null);
    closePropertiesPanel();
    closeContextMenu();
    closeConnectionMenu();
    setConnectStart(null);
  };

  const handlePaneContextMenu = (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const clientX = "clientX" in e ? e.clientX : 0;
    const clientY = "clientY" in e ? e.clientY : 0;
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
    setConnectStart(null);
    closeConnectionMenu();
    openContextMenu({
      screenX: clientX,
      screenY: clientY,
      flowX: flowPos.x,
      flowY: flowPos.y,
    });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={handleConnect}
      onConnectStart={handleConnectStart}
      onConnectEnd={handleConnectEnd}
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
  );
};
