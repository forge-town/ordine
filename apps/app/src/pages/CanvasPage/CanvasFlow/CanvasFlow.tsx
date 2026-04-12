import { useMemo, useRef, useCallback } from "react";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  useReactFlow,
  type OnInit,
  type OnConnectStart,
  type OnConnectEnd,
  type OnNodeDrag,
} from "@xyflow/react";
import type { PipelineNode, PipelineEdge } from "../_store/canvasSlice";
import { CompoundNode } from "../CompoundNode";
import { ConditionNode } from "../ConditionNode";
import { CodeFileNode } from "../CodeFileNode";
import { ErrorNode } from "../ErrorNode";
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
  const openConnectionMenu = useStore(
    store,
    (state) => state.openConnectionMenu,
  );
  const storeHandleConnectStart = useStore(
    store,
    (state) => state.handleConnectStart,
  );
  const showPaneContextMenu = useStore(
    store,
    (state) => state.showPaneContextMenu,
  );
  const showNodeContextMenu = useStore(
    store,
    (state) => state.showNodeContextMenu,
  );
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const setHoveredCompound = useStore(
    store,
    (state) => state.setHoveredCompound,
  );
  const addNodeToCompound = useStore(store, (state) => state.addNodeToCompound);

  // ─── Drag-into-compound detection ────────────────────────────────────────────
  const handleNodeDrag: OnNodeDrag<PipelineNode> = useCallback(
    (_event, draggedNode) => {
      if (draggedNode.type === "compound") return;

      const compoundNodes = nodes.filter(
        (n) => n.type === "compound" && n.id !== draggedNode.id,
      );

      let foundCompound: string | null = null;
      for (const cn of compoundNodes) {
        const cw = (cn.style?.width as number) ?? cn.measured?.width ?? 280;
        const ch = (cn.style?.height as number) ?? cn.measured?.height ?? 120;
        const cx = cn.position.x;
        const cy = cn.position.y;

        if (
          draggedNode.position.x >= cx &&
          draggedNode.position.x <= cx + cw &&
          draggedNode.position.y >= cy &&
          draggedNode.position.y <= cy + ch
        ) {
          foundCompound = cn.id;
          break;
        }
      }
      setHoveredCompound(foundCompound);
    },
    [nodes, setHoveredCompound],
  );

  const handleNodeDragStop: OnNodeDrag<PipelineNode> = useCallback(
    (_event, draggedNode) => {
      const hovered = store.getState().hoveredCompoundId;
      if (
        hovered &&
        draggedNode.id !== hovered &&
        draggedNode.type !== "compound"
      ) {
        addNodeToCompound(draggedNode.id, hovered);
      }
      setHoveredCompound(null);
    },
    [store, addNodeToCompound, setHoveredCompound],
  );

  // ─── Undo / Redo keyboard shortcuts ──────────────────────────────────────────
  useHotkeys(
    "mod+z",
    (e) => {
      e.preventDefault();
      handleUndo();
    },
    { preventDefault: false },
  );
  useHotkeys(
    "mod+shift+z, mod+y",
    (e) => {
      e.preventDefault();
      handleRedo();
    },
    { preventDefault: false },
  );

  const { screenToFlowPosition } = useReactFlow();

  const handleInit: OnInit<PipelineNode, PipelineEdge> = useCallback(
    (instance) => {
      store.setState({
        fitView: (options?: { padding?: number }) => instance.fitView(options),
        handleZoomIn: () => instance.zoomIn(),
        handleZoomOut: () => instance.zoomOut(),
      });
    },
    [store],
  );

  // 使用 useMemo 缓存 nodeTypes - React Flow 最佳实践
  const nodeTypes = useMemo(
    () => ({
      default: ErrorNode,
      operation: OperationNode,
      compound: CompoundNode,
      condition: ConditionNode,
      "code-file": CodeFileNode,
      folder: FolderNode,
      "github-project": GitHubProjectNode,
      "output-project-path": OutputProjectPathNode,
      "output-local-path": OutputLocalPathNode,
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
        "changedTouches" in event
          ? (event as TouchEvent).changedTouches[0]
          : (event as MouseEvent);

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
    // If the node is already part of a multi-selection, preserve it
    if (!node.selected) {
      focusNode(node.id);
    }
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
      onInit={handleInit}
      onNodeClick={handleNodeClick}
      onNodeContextMenu={handleNodeContextMenu}
      onNodeDrag={handleNodeDrag}
      onNodeDragStop={handleNodeDragStop}
      onNodesChange={handleNodesChange}
      onPaneClick={handlePaneClick}
      onPaneContextMenu={handlePaneContextMenu}
    >
      <Background
        color="#cbd5e1"
        gap={24}
        size={1.5}
        variant={BackgroundVariant.Dots}
      />
      <Controls
        showInteractive
        className="border-gray-200! bg-white! shadow-sm!"
        position="bottom-left"
      />
    </ReactFlow>
  );
};
