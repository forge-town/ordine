import { useMemo, useRef, useEffect } from "react";
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
import { ConditionNode } from "../ConditionNode";
import { CodeFileNode } from "../CodeFileNode";
import { FolderNode } from "../FolderNode";
import { GitHubProjectNode } from "../GitHubProjectNode";
import { OperationNode } from "../OperationNode";
import { OutputProjectPathNode } from "../OutputProjectPathNode";
import { OutputLocalPathNode } from "../OutputLocalPathNode";

export const CanvasFlow = () => {
  const store = useHarnessCanvasStore();
  // Suppress pane click that React Flow fires right after a connection drag-end
  const shouldIgnorePaneClick = useRef(false);

  // 使用浅比较选择器，避免不必要重渲染
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const handleNodesChange = useStore(store, (state) => state.handleNodesChange);
  const handleEdgesChange = useStore(store, (state) => state.handleEdgesChange);
  const handleConnect = useStore(store, (state) => state.handleConnect);
  const focusNode = useStore(store, (state) => state.focusNode);
  const focusEdge = useStore(store, (state) => state.focusEdge);
  const clearSelection = useStore(store, (state) => state.clearSelection);
  const openConnectionMenu = useStore(store, (state) => state.openConnectionMenu);
  const storeHandleConnectStart = useStore(store, (state) => state.handleConnectStart);
  const showPaneContextMenu = useStore(store, (state) => state.showPaneContextMenu);
  const showNodeContextMenu = useStore(store, (state) => state.showNodeContextMenu);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);

  // ─── Undo / Redo keyboard shortcuts ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey;
      const isRedo = (e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey));

      if (isUndo) {
        e.preventDefault();
        handleUndo();
      } else if (isRedo) {
        e.preventDefault();
        handleRedo();
      }
    };
    globalThis.addEventListener("keydown", handler);
    return () => globalThis.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  useEffect(() => {
    store.setState({
      fitView: (options?: { padding?: number }) => fitView(options),
      handleZoomIn: () => zoomIn(),
      handleZoomOut: () => zoomOut(),
    });
  }, [store, fitView, zoomIn, zoomOut]);

  // 使用 useMemo 缓存 nodeTypes - React Flow 最佳实践
  const nodeTypes = useMemo(
    () => ({
      operation: OperationNode,
      condition: ConditionNode,
      "code-file": CodeFileNode,
      folder: FolderNode,
      "github-project": GitHubProjectNode,
      "output-project-path": OutputProjectPathNode,
      "output-local-path": OutputLocalPathNode,
    }),
    []
  );

  // 使用 useMemo 缓存 defaultEdgeOptions
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "default" as const,
      animated: true,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }),
    []
  );

  const handleConnectStart: OnConnectStart = (_, params) => {
    // 记录连接开始状态
    if (!params.nodeId) return;
    storeHandleConnectStart({
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
      handleType: params.handleType ?? null,
    });
  };

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    // User connected to a valid handle — no menu needed
    if (connectionState.isValid === true) {
      storeHandleConnectStart(null);
      return;
    }

    // !isValid (null = empty space, false = invalid handle) — open connection menu
    // Use connectionState.fromNode directly (more reliable than stored connectStart)
    const fromNode = connectionState.fromNode;
    const fromHandle = connectionState.fromHandle;

    if (fromNode) {
      const { clientX, clientY } =
        "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);

      // Re-set connectStart from live connectionState data
      storeHandleConnectStart({
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

    storeHandleConnectStart(null);
  };

  const handleNodeClick = (_: React.MouseEvent, node: PipelineNode) => {
    focusNode(node.id);
  };

  const handleNodeContextMenu = (e: React.MouseEvent, node: PipelineNode) => {
    e.preventDefault();
    focusNode(node.id);
    showNodeContextMenu(node.id, e.clientX, e.clientY);
  };

  const handleEdgeClick = (_: React.MouseEvent, edge: PipelineEdge) => {
    focusEdge(edge.id);
  };

  const handlePaneClick = () => {
    if (shouldIgnorePaneClick.current) return;
    clearSelection();
  };

  const handlePaneContextMenu = (e: React.MouseEvent | MouseEvent) => {
    e.preventDefault();
    const clientX = "clientX" in e ? e.clientX : 0;
    const clientY = "clientY" in e ? e.clientY : 0;
    const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
    showPaneContextMenu({
      screenX: clientX,
      screenY: clientY,
      flowX: flowPos.x,
      flowY: flowPos.y,
    });
  };

  return (
    <ReactFlow
      fitView
      className="bg-slate-50/50"
      defaultEdgeOptions={defaultEdgeOptions}
      deleteKeyCode={["Backspace", "Delete"]}
      edges={edges}
      fitViewOptions={{ padding: 0.15 }}
      nodes={nodes}
      nodeTypes={nodeTypes}
      proOptions={{ hideAttribution: false }}
      onConnect={handleConnect}
      onConnectEnd={handleConnectEnd}
      onConnectStart={handleConnectStart}
      onEdgeClick={handleEdgeClick}
      onEdgesChange={handleEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeContextMenu={handleNodeContextMenu}
      onNodesChange={handleNodesChange}
      onPaneClick={handlePaneClick}
      onPaneContextMenu={handlePaneContextMenu}
    >
      <Background color="#cbd5e1" gap={24} size={1.5} variant={BackgroundVariant.Dots} />
      <Controls
        showInteractive
        className="border-gray-200! bg-white! shadow-sm!"
        position="bottom-left"
      />
    </ReactFlow>
  );
};
