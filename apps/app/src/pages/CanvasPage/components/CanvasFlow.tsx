import { useMemo } from "react";
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
      type: "smoothstep" as const,
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
    // 连接成功后清除连接状态
    setConnectStart(null);
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

  const handleConnectEnd: OnConnectEnd = (event) => {
    const state = store.getState();

    // 只有在连接未完成且是有效的拖拽结束时才弹出菜单
    if (state.connectStart && event && "clientX" in event) {
      const { connectStart, nodes } = state;

      // 获取源节点类型
      const sourceNode = nodes.find((n) => n.id === connectStart.nodeId);
      if (!sourceNode) {
        setConnectStart(null);
        return;
      }

      // 计算放手位置
      const clientX = (event as MouseEvent).clientX;
      const clientY = (event as MouseEvent).clientY;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });

      // 打开菜单（用于创建新节点并连接）
      openContextMenu({
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    }

    // 注意：不清除 connectStart，菜单需要知道源节点信息
  };

  const handleNodeClick = (_: React.MouseEvent, node: PipelineNode) => {
    selectNode(node.id);
    openPropertiesPanel();
    closeContextMenu();
    setConnectStart(null);
  };

  const handleEdgeClick = (_: React.MouseEvent, edge: PipelineEdge) => {
    selectEdge(edge.id);
    openPropertiesPanel();
    closeContextMenu();
    setConnectStart(null);
  };

  const handlePaneClick = () => {
    selectNode(null);
    selectEdge(null);
    closePropertiesPanel();
    closeContextMenu();
    setConnectStart(null);
  };

  const handlePaneContextMenu = (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const clientX = "clientX" in e ? e.clientX : 0;
    const clientY = "clientY" in e ? e.clientY : 0;
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
    // 右键菜单时清除连接状态
    setConnectStart(null);
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
