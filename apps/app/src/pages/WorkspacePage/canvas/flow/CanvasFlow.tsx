import { useEffect, useMemo, type DragEvent } from "react";
import { useDataProvider } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  useReactFlow,
  useNodesInitialized,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeMouseHandler,
  type ProOptions,
} from "@xyflow/react";
import type { CompoundNodeData } from "@repo/schemas";
import { toastStore } from "@/store/toastStore";
import { SemanticEdge } from "../edges";
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
import { makeOperationNodeData } from "../utils/makeOperationNodeData";
import { resolveSkillOperation } from "../utils/resolveSkillOperation";

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

const edgeTypes = {
  semantic: SemanticEdge,
};

const defaultEdgeOptions = {
  type: "semantic",
} satisfies Partial<CanvasEdge>;

const proOptions: ProOptions = { hideAttribution: true };
const defaultViewport = { x: 0, y: 0, zoom: 0.9 };

const hasNodeChangeMutation = (changes: NodeChange<CanvasNode>[]): boolean =>
  changes.some((change) => change.type !== "select" && change.type !== "dimensions");

const hasEdgeChangeMutation = (changes: EdgeChange<CanvasEdge>[]): boolean =>
  changes.some((change) => change.type !== "select");

const handleComponentDragOver = (event: DragEvent<HTMLDivElement>) => {
  if (!hasCanvasComponentDragPayload(event.dataTransfer.types)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

export const CanvasFlow = () => {
  const { i18n } = useTranslation();
  const getDataProvider = useDataProvider();
  const canvasStore = useCanvasStoreApi();
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
  const configNodeId = useCanvasStore((state) => state.configNodeId);
  const inspectEdgeId = useCanvasStore((state) => state.inspectEdgeId);
  const setConfigNodeId = useCanvasStore((state) => state.setConfigNodeId);
  const setInspectEdgeId = useCanvasStore((state) => state.setInspectEdgeId);
  const pushDrillStack = useCanvasStore((state) => state.pushDrillStack);
  const popDrillStack = useCanvasStore((state) => state.popDrillStack);
  const redo = useCanvasStore((state) => state.redo);
  const selectEdge = useCanvasStore((state) => state.selectEdge);
  const selectNode = useCanvasStore((state) => state.selectNode);
  const setSelectedIds = useCanvasStore((state) => state.setSelectedIds);
  const undo = useCanvasStore((state) => state.undo);
  const proposalPreview = useCanvasStore((state) => state.proposalPreview);
  const nodesInitialized = useNodesInitialized();
  const { fitView, screenToFlowPosition } = useReactFlow<CanvasNode, CanvasEdge>();
  const isPreviewing = proposalPreview !== null && drillStack.length === 0;
  const isDrilling = drillStack.length > 0;
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
    () => routedEdges.map((edge) => ({ ...edge, animated: false, type: "semantic" })),
    [routedEdges],
  );
  const visibleNodeIds = visibleGraph.nodes.map((node) => node.id).join("\u0000");

  useEffect(() => {
    if (!nodesInitialized || visibleGraph.nodes.length === 0) {
      return;
    }

    void fitView({ padding: 0.1 });
  }, [fitView, nodesInitialized, visibleNodeIds, visibleGraph.nodes.length]);

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (isPreviewing || isDrilling) {
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
    if (payload.kind === "object") {
      addNodeFromCatalog({ position, type: payload.type });

      return;
    }

    if (payload.kind === "operation") {
      addNodeFromCatalog({
        data: makeOperationNodeData(payload.operation),
        position,
        type: "operation",
      });

      return;
    }

    if (payload.kind === "skill") {
      const operationResult = await ResultAsync.fromPromise(
        resolveSkillOperation(getDataProvider(), payload.skill),
        () => null,
      );
      if (operationResult.isErr()) {
        toastStore.getState().addToast({
          description: payload.skill.label || payload.skill.name,
          title: i18n.t("workspace.canvas.nodes.skillCreateFailed"),
          type: "error",
        });

        return;
      }

      const state = canvasStore.getState();
      if (state.proposalPreview !== null || state.drillStack.length > 0) {
        return;
      }

      state.addNodeFromCatalog({
        data: makeOperationNodeData(operationResult.value),
        position,
        type: "operation",
      });

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
  };

  const handleFlowConnect = (connection: Connection) => {
    if (isPreviewing || isDrilling) {
      return;
    }

    handleConnect(connection);
  };

  const handleFlowEdgesChange = (changes: EdgeChange<CanvasEdge>[]) => {
    if ((isPreviewing || isDrilling) && hasEdgeChangeMutation(changes)) {
      return;
    }

    handleEdgesChange(changes);
  };

  const handleFlowNodesChange = (changes: NodeChange<CanvasNode>[]) => {
    if (isPreviewing && hasNodeChangeMutation(changes)) {
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
    if (isPreviewing || isDrilling || selectedIds.length === 0) {
      return;
    }

    deleteSelected(selectedIds);
    setSelectedIds([]);
  };

  const handleUndo = () => {
    if (!isPreviewing) {
      undo();
    }
  };

  const handleRedo = () => {
    if (!isPreviewing) {
      redo();
    }
  };

  const handleFlowDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isDrilling) {
      handleComponentDragOver(event);
    }
  };

  useHotkeys("backspace, delete", handleDeleteSelection, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("mod+z", handleUndo, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys("mod+shift+z, mod+y", handleRedo, {
    enableOnContentEditable: false,
    enableOnFormTags: false,
    preventDefault: true,
  });
  useHotkeys(
    "escape",
    () => {
      if (configNodeId || inspectEdgeId) {
        setConfigNodeId(null);
        setInspectEdgeId(null);

        return;
      }
      if (drillStack.length > 0) {
        popDrillStack();

        return;
      }
      setSelectedIds([]);
    },
    {
      enableOnContentEditable: false,
      enableOnFormTags: true,
    },
  );

  return (
    <div
      className="h-full w-full"
      data-testid="canvas-v2-flow"
      lang={i18n.language}
      onDragOver={handleFlowDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow<CanvasNode, CanvasEdge>
        panOnScroll={false}
        zoomOnPinch
        zoomOnScroll
        className="bg-transparent"
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={defaultViewport}
        deleteKeyCode={null}
        edges={renderedEdges}
        edgeTypes={edgeTypes}
        maxZoom={1.6}
        minZoom={0.35}
        nodeDragThreshold={2}
        nodes={visibleGraph.nodes}
        nodesConnectable={!isPreviewing && !isDrilling}
        nodesDraggable={!isPreviewing}
        nodeTypes={nodeTypes}
        panOnDrag={canvasTool === "hand" ? true : [1, 2]}
        proOptions={proOptions}
        selectionOnDrag={canvasTool === "select"}
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
