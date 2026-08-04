import { useMemo, useRef, type DragEvent } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type ProOptions,
} from "@xyflow/react";
import type { CompoundNodeData } from "@repo/schemas";
import {
  CompoundNode,
  FileNode,
  FolderNode,
  GithubProjectNode,
  OperationNode,
  OutputLocalPathNode,
  OutputProjectPathNode,
  PromptNode,
} from "../nodes";
import { useCanvasStore, useCanvasStoreApi } from "../_store/canvasStore";
import type { CanvasEdge, CanvasNode } from "../_store/canvasTypes";
import { decorateEdgesWithPortHandles } from "../nodes/support/nodePorts";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  decodeCanvasComponentDragPayload,
  hasCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { makeDefaultNodeData } from "../utils/makeDefaultNodeData";
import { makeOperationNodeData, makeSkillOperationNodeData } from "../utils/makeOperationNodeData";

const nodeTypes = {
  compound: CompoundNode,
  file: FileNode,
  folder: FolderNode,
  "github-project": GithubProjectNode,
  operation: OperationNode,
  "output-local-path": OutputLocalPathNode,
  "output-project-path": OutputProjectPathNode,
  prompt: PromptNode,
};

const defaultEdgeOptions = {
  type: "default",
} satisfies Partial<CanvasEdge>;

const proOptions: ProOptions = { hideAttribution: true };
const defaultViewport = { x: 0, y: 0, zoom: 0.9 };

const makeSnapshot = (nodes: CanvasNode[], edges: CanvasEdge[]) => ({ edges, nodes });

const hasNodeChangeMutation = (changes: NodeChange<CanvasNode>[]): boolean =>
  changes.some((change) => change.type !== "select" && change.type !== "dimensions");

const hasEdgeChangeMutation = (changes: EdgeChange<CanvasEdge>[]): boolean =>
  changes.some((change) => change.type !== "select");

const getNodeDragPhase = (changes: NodeChange<CanvasNode>[]): "dragging" | "ended" | null => {
  const positionChanges = changes.filter((change) => change.type === "position");
  if (positionChanges.some((change) => change.dragging === true)) {
    return "dragging";
  }
  if (positionChanges.some((change) => change.dragging === false)) {
    return "ended";
  }

  return null;
};

const handleComponentDragOver = (event: DragEvent<HTMLDivElement>) => {
  if (!hasCanvasComponentDragPayload(event.dataTransfer.types)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

export const CanvasFlow = () => {
  const { i18n } = useTranslation();
  const canvasStore = useCanvasStoreApi();
  const nodeDragSnapshotRef = useRef<ReturnType<typeof makeSnapshot> | null>(null);
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const canvasTool = useCanvasStore((state) => state.canvasTool);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const getVisibleGraph = useCanvasStore((state) => state.getVisibleGraph);
  const selectedIds = useCanvasStore((state) => state.selectedIds);
  const addNodeFromCatalog = useCanvasStore((state) => state.addNodeFromCatalog);
  const deleteSelected = useCanvasStore((state) => state.deleteSelected);
  const handleConnect = useCanvasStore((state) => state.handleConnect);
  const handleEdgesChange = useCanvasStore((state) => state.handleEdgesChange);
  const handleNodesChange = useCanvasStore((state) => state.handleNodesChange);
  const openEdgeInspector = useCanvasStore((state) => state.openEdgeInspector);
  const openNodeConfig = useCanvasStore((state) => state.openNodeConfig);
  const pushDrillStack = useCanvasStore((state) => state.pushDrillStack);
  const popDrillStack = useCanvasStore((state) => state.popDrillStack);
  const recordHistory = useCanvasStore((state) => state.recordHistory);
  const redo = useCanvasStore((state) => state.redo);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const undo = useCanvasStore((state) => state.undo);
  const proposalPreview = useCanvasStore((state) => state.proposalPreview);
  const { screenToFlowPosition } = useReactFlow<CanvasNode, CanvasEdge>();
  const isPreviewing = proposalPreview !== null && drillStack.length === 0;
  const visibleGraph =
    proposalPreview && drillStack.length === 0
      ? { edges: proposalPreview.edges, nodes: proposalPreview.nodes }
      : drillStack.length > 0
        ? getVisibleGraph()
        : { edges, nodes };
  const routedEdges = useMemo(
    () => decorateEdgesWithPortHandles(visibleGraph.nodes, visibleGraph.edges),
    [visibleGraph.edges, visibleGraph.nodes],
  );
  const renderedEdges = useMemo(
    () => routedEdges.map((edge) => ({ ...edge, animated: false, type: "default" })),
    [routedEdges],
  );

  const getCurrentGraphSnapshot = () => {
    const state = canvasStore.getState();

    return makeSnapshot(state.nodes, state.edges);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (isPreviewing) {
      return;
    }

    const payload = decodeCanvasComponentDragPayload(
      event.dataTransfer.getData(CANVAS_COMPONENT_DRAG_MIME),
    );
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const previous = getCurrentGraphSnapshot();

    if (payload.kind === "object") {
      addNodeFromCatalog({ position, type: payload.type });
      recordHistory(previous);

      return;
    }

    if (payload.kind === "operation") {
      addNodeFromCatalog({
        data: makeOperationNodeData(payload.operation),
        position,
        type: "operation",
      });
      recordHistory(previous);

      return;
    }

    if (payload.kind === "skill") {
      addNodeFromCatalog({
        data: makeSkillOperationNodeData(payload.skill),
        position,
        type: "operation",
      });
      recordHistory(previous);

      return;
    }

    addNodeFromCatalog({
      data: {
        ...(makeDefaultNodeData("compound", { label: payload.compoundKind }) as CompoundNodeData),
        compoundKind: payload.compoundKind,
      },
      position,
      type: "compound",
    });
    recordHistory(previous);
  };

  const handleFlowConnect = (connection: Connection) => {
    if (isPreviewing) {
      return;
    }

    const previous = getCurrentGraphSnapshot();
    handleConnect(connection);
    recordHistory(previous);
  };

  const handleFlowEdgesChange = (changes: EdgeChange<CanvasEdge>[]) => {
    if (isPreviewing && hasEdgeChangeMutation(changes)) {
      return;
    }

    const previous = getCurrentGraphSnapshot();
    if (hasEdgeChangeMutation(changes)) {
      handleEdgesChange(changes);
      recordHistory(previous);

      return;
    }
    handleEdgesChange(changes);
  };

  const handleFlowNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    if (isPreviewing && hasNodeChangeMutation(changes)) {
      nodeDragSnapshotRef.current = null;

      return;
    }

    const dragPhase = getNodeDragPhase(changes);
    if (dragPhase === "dragging") {
      nodeDragSnapshotRef.current ??= getCurrentGraphSnapshot();
      handleNodesChange(changes);

      return;
    }
    if (dragPhase === "ended" && nodeDragSnapshotRef.current) {
      const previous = nodeDragSnapshotRef.current;
      nodeDragSnapshotRef.current = null;
      handleNodesChange(changes);
      recordHistory(previous);

      return;
    }

    const previous = getCurrentGraphSnapshot();
    if (hasNodeChangeMutation(changes)) {
      handleNodesChange(changes);
      recordHistory(previous);

      return;
    }
    handleNodesChange(changes);
  };

  const handleNodeDoubleClick: NodeMouseHandler<CanvasNode> = (_event, node) => {
    if (isPreviewing) {
      return;
    }

    if (node.type === "compound") {
      pushDrillStack(node.id);

      return;
    }

    openNodeConfig(node.id);
  };

  const handleEdgeClick = (_event: React.MouseEvent, edge: CanvasEdge) => {
    selectEdge(edge.id);
    openEdgeInspector(edge.id);
  };

  const handleNodeClick: NodeMouseHandler<CanvasNode> = (_event, node) => selectNode(node.id);

  const handlePaneClick = () => setSelectedIds([]);

  const handleSelectionChange = ({
    edges: selectedEdges,
    nodes: selectedNodes,
  }: {
    edges: CanvasEdge[];
    nodes: CanvasNode[];
  }) => {
    setSelectedIds([
      ...selectedNodes.map((node) => node.id),
      ...selectedEdges.map((edge) => edge.id),
    ]);
  };

  const handleDeleteSelection = () => {
    if (isPreviewing || selectedIds.length === 0) {
      return;
    }

    const previous = getCurrentGraphSnapshot();
    deleteSelected(selectedIds);
    setSelectedIds([]);
    recordHistory(previous);
  };

  useHotkeys("backspace, delete", handleDeleteSelection, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("mod+z", undo, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("mod+shift+z, mod+y", redo, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys(
    "escape",
    () => {
      if (drillStack.length > 0) {
        popDrillStack();

        return;
      }
      setSelectedIds([]);
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: false,
    },
  );

  return (
    <div
      className="h-full w-full"
      data-testid="canvas-v2-flow"
      lang={i18n.language}
      onDragOver={handleComponentDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow<CanvasNode, CanvasEdge>
        fitView
        panOnScroll
        zoomOnPinch
        className="bg-transparent"
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={defaultViewport}
        deleteKeyCode={null}
        edges={renderedEdges}
        maxZoom={1.6}
        minZoom={0.35}
        nodeDragThreshold={2}
        nodes={visibleGraph.nodes}
        nodesConnectable={!isPreviewing}
        nodesDraggable={!isPreviewing}
        nodeTypes={nodeTypes}
        panOnDrag={canvasTool === "hand" ? true : [1, 2]}
        proOptions={proOptions}
        selectionOnDrag={canvasTool === "select"}
        zoomOnScroll={false}
        onConnect={handleFlowConnect}
        onEdgeClick={handleEdgeClick}
        onEdgesChange={handleFlowEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodesChange={handleFlowNodesChange}
        onPaneClick={handlePaneClick}
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
};
