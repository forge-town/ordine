import type { PipelineEdge, PipelineNode } from "./canvasSlice";
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";
import type { Operation, Recipe } from "@repo/schemas";
import type { PickedProject } from "../GitHubProjectNode/PickProjectDialog";
import type { ConnectedRepoInfo } from "../GitHubProjectNode/GitHubConnectDialog";
import type { LocalFolderInfo } from "../GitHubProjectNode/PickLocalFolderDialog";
import { makeDefaultNodeData } from "../utils/makeDefaultNodeData";
import { makeOperationNodeData } from "../utils/makeOperationNodeData";
import type { NodeType, BuiltinNodeType } from "@repo/pipeline-engine/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { ResultAsync } from "neverthrow";
import i18n from "@/lib/i18n";
import type { ReactFlowInstance, OnConnectStartParams } from "@xyflow/react";
import type { FinalConnectionState, XYPosition } from "@xyflow/system";
import {
  CONNECTION_MENU_NODE_OFFSET,
  NODE_CONTEXT_CONNECT_OFFSET,
  QUICK_ADD_NODE_ORIGIN,
  getScreenViewportCenter,
  offsetPosition,
} from "../utils/nodePosition";

export interface ActionsSlice {
  exportCanvas: () => void;
  importCanvas: (data: { nodes: PipelineNode[]; edges: PipelineEdge[] }) => void;
  fitView: (options?: { padding?: number }) => void;
  screenToFlowPosition: (pos: XYPosition) => XYPosition;
  getViewportScreenCenter: () => XYPosition;
  setViewportScreenCenterGetter: (getter: () => XYPosition) => void;
  handleFitView: () => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;

  // React Flow integration — signatures match React Flow callbacks exactly
  handleFlowInit: (instance: ReactFlowInstance<PipelineNode, PipelineEdge>) => void;
  handleFlowConnectStart: (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => void;
  handleFlowConnectEnd: (
    event: MouseEvent | TouchEvent,
    connectionState: FinalConnectionState
  ) => void;
  handleFlowNodeClick: (event: React.MouseEvent, node: PipelineNode) => void;
  handleFlowNodeContextMenu: (event: React.MouseEvent, node: PipelineNode) => void;
  handleFlowEdgeClick: (event: React.MouseEvent, edge: PipelineEdge) => void;
  handleFlowPaneClick: (event: React.MouseEvent) => void;
  handleFlowPaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  handleFlowNodeDrag: (event: React.MouseEvent, node: PipelineNode, nodes: PipelineNode[]) => void;
  handleFlowNodeDragStop: (
    event: React.MouseEvent,
    node: PipelineNode,
    nodes: PipelineNode[]
  ) => void;

  // Cross-slice semantic actions
  focusNode: (nodeId: string) => void;
  focusEdge: (edgeId: string) => void;
  clearSelection: () => void;
  handleDeleteSelected: () => void;
  dropNodeOntoCompound: (nodeId: string) => void;
  handleDragOverCompound: (draggedNodeId: string, position: { x: number; y: number }) => void;
  handleDragEndOnCompound: (draggedNodeId: string, isCompound: boolean) => void;
  handleRunTest: () => Promise<void>;
  addNodeAndAutoConnect: (node: PipelineNode) => void;
  createObjectNode: (type: NodeType) => void;
  createOperationNode: (operation: Operation) => void;
  createRecipeNode: (recipe: Recipe, operation: Operation) => void;
  createObjectNodeAtViewportCenter: (type: NodeType) => void;
  createOperationNodeAtViewportCenter: (operation: Operation) => void;
  createRecipeNodeAtViewportCenter: (recipe: Recipe, operation: Operation) => void;
  dismissContextMenu: () => void;
  handleContextMenuOpenChange: (open: boolean) => void;
  connectObjectNode: (type: NodeType) => void;
  connectOperationNode: (operation: Operation) => void;
  connectRecipeNode: (recipe: Recipe, operation: Operation) => void;
  dismissConnectionMenu: () => void;
  handleConnectionMenuOpenChange: (open: boolean) => void;

  // Node context menu actions
  handleNodeContextMenuOpenChange: (open: boolean) => void;
  nodeContextDuplicate: () => void;
  nodeContextDelete: () => void;
  nodeContextUngroup: () => void;
  nodeContextDetach: () => void;
  nodeContextGroupSelected: () => void;
  nodeContextAddObject: (type: NodeType) => void;
  nodeContextAddOperation: (operation: Operation) => void;
  nodeContextAddRecipe: (recipe: Recipe, operation: Operation) => void;

  // Node data actions
  handleGitHubProjectPick: (nodeId: string, picked: PickedProject) => void;
  handleGitHubProjectConnect: (nodeId: string, info: ConnectedRepoInfo) => void;
  handleGitHubProjectLocalFolder: (nodeId: string, info: LocalFolderInfo) => void;
  handleNodeAddExcludedPath: (nodeId: string, path: string) => void;
  handleNodeRemoveExcludedPath: (nodeId: string, path: string) => void;
}

export const createActionsSlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  get: Parameters<HarnessCanvasStoreSlice>[1]
): ActionsSlice => ({
  exportCanvas: () => {
    const state = get();
    const exportData = {
      name: state.pipelineName || "untitled",
      nodes: state.nodes,
      edges: state.edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.pipelineName || "pipeline"}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  importCanvas: ({ nodes, edges }) => {
    set({ nodes, edges, selectedNodeId: null, selectedEdgeId: null });
  },
  fitView: () => {},
  screenToFlowPosition: (pos) => pos,
  getViewportScreenCenter: () => getScreenViewportCenter(),
  setViewportScreenCenterGetter: (getter) => {
    set({ getViewportScreenCenter: getter });
  },
  handleFitView: () => {
    get().fitView({ padding: 0.1 });
  },
  // TODO: Imp
  handleZoomIn: () => {},
  // TODO: Imp
  handleZoomOut: () => {},

  focusNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
      isQuickAddOpen: false,
    });
  },

  focusEdge: (edgeId) => {
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
      isQuickAddOpen: false,
    });
  },

  clearSelection: () => {
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
      isQuickAddOpen: false,
    });
  },

  handleDeleteSelected: () => {
    const { selectedNodeId } = get();
    if (selectedNodeId) {
      get().removeNode(selectedNodeId);
    }
  },

  dropNodeOntoCompound: (nodeId) => {
    const { hoveredCompoundId } = get();
    if (hoveredCompoundId && nodeId !== hoveredCompoundId) {
      get().addNodeToCompound(nodeId, hoveredCompoundId);
    }
    set({ hoveredCompoundId: null });
  },

  handleDragOverCompound: (draggedNodeId, position) => {
    const { nodes } = get();
    const compoundNodes = nodes.filter((n) => n.type === "compound" && n.id !== draggedNodeId);

    const foundCompound = compoundNodes.find((cn) => {
      const cw = (cn.style?.width as number) ?? cn.measured?.width ?? 280;
      const ch = (cn.style?.height as number) ?? cn.measured?.height ?? 120;
      const cx = cn.position.x;
      const cy = cn.position.y;

      return position.x >= cx && position.x <= cx + cw && position.y >= cy && position.y <= cy + ch;
    });
    get().setHoveredCompound(foundCompound?.id ?? null);
  },

  handleDragEndOnCompound: (draggedNodeId, isCompound) => {
    if (isCompound) {
      get().setHoveredCompound(null);
    } else {
      get().dropNodeOntoCompound(draggedNodeId);
    }
  },

  // ── React Flow integration ─────────────────────────────────────────────

  handleFlowInit: (instance) => {
    set({
      fitView: (options?: { padding?: number }) => instance.fitView(options),
      screenToFlowPosition: (pos) => instance.screenToFlowPosition(pos),
      handleZoomIn: () => instance.zoomIn(),
      handleZoomOut: () => instance.zoomOut(),
    });
  },

  handleFlowConnectStart: (_event, params) => {
    if (!params.nodeId) return;
    get().handleConnectStart({
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
      handleType: params.handleType ?? null,
    });
  },

  handleFlowConnectEnd: (event, connectionState) => {
    if (connectionState.isValid === true) {
      get().handleConnectStart(null);

      return;
    }

    const fromNodeId = connectionState.fromNode?.id ?? null;

    if (fromNodeId) {
      get().handleConnectStart({
        nodeId: fromNodeId,
        handleId: connectionState.fromHandle?.id ?? null,
        handleType: connectionState.fromHandle?.type ?? null,
      });

      const { clientX, clientY } =
        "changedTouches" in event ? (event as TouchEvent).changedTouches[0] : (event as MouseEvent);
      const flowPos = get().screenToFlowPosition({ x: clientX, y: clientY });

      get().openConnectionMenu({
        screenX: clientX,
        screenY: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });

      set({ shouldIgnorePaneClick: true });
      setTimeout(() => {
        set({ shouldIgnorePaneClick: false });
      }, 100);

      return;
    }

    get().handleConnectStart(null);
  },

  handleFlowNodeClick: (_event, node) => {
    get().focusNode(node.id);
  },

  handleFlowNodeContextMenu: (event, node) => {
    event.preventDefault();
    if (!node.selected) {
      get().focusNode(node.id);
    }
    get().showNodeContextMenu(node.id, event.clientX, event.clientY);
  },

  handleFlowEdgeClick: (_event, edge) => {
    get().focusEdge(edge.id);
  },

  handleFlowPaneClick: () => {
    if (get().shouldIgnorePaneClick) return;
    get().clearSelection();
  },

  handleFlowPaneContextMenu: (event) => {
    event.preventDefault();
    const clientX = "clientX" in event ? event.clientX : 0;
    const clientY = "clientY" in event ? event.clientY : 0;
    const flowPos = get().screenToFlowPosition({ x: clientX, y: clientY });
    get().showPaneContextMenu({
      screenX: clientX,
      screenY: clientY,
      flowX: flowPos.x,
      flowY: flowPos.y,
    });
  },

  handleFlowNodeDrag: (_event, node) => {
    if (node.type === "compound") return;
    get().handleDragOverCompound(node.id, node.position);
  },

  handleFlowNodeDragStop: (_event, node) => {
    get().handleDragEndOnCompound(node.id, node.type === "compound");
  },

  handleRunTest: async () => {
    const {
      isRunning,
      isTestRunning,
      pipelineId,
      pipelineName,
      nodes,
      edges,
      startTestRun,
      setActiveJobId,
    } = get();
    const t = i18n.t.bind(i18n);

    if (isRunning || isTestRunning) return;

    if (!pipelineId) {
      toastStore.getState().addToast({
        type: "error",
        title: t("canvas.runFailed"),
        description: t("canvas.noPipelineId"),
      });

      return;
    }

    set({ isRunning: true });
    startTestRun();

    const saveResult = await ResultAsync.fromPromise(
      dataProvider.update!({
        resource: ResourceName.pipelines,
        id: pipelineId,
        variables: {
          name: pipelineName || t("canvas.unsavedPipeline"),
          nodes,
          edges,
        },
      }),
      () => "save-failed" as const
    );

    if (saveResult.isErr()) {
      toastStore.getState().addToast({
        type: "error",
        title: t("canvas.runFailed"),
        description: t("canvas.saveFailed"),
      });
      set({ isRunning: false });

      return;
    }

    const runResult = await ResultAsync.fromPromise(
      dataProvider.custom!({
        url: "pipelines/run",
        method: "post",
        payload: { id: pipelineId },
      }),
      () => "Failed to start pipeline"
    );

    runResult.match(
      (data) => {
        const result = data.data as { jobId: string };
        setActiveJobId(result.jobId);
        toastStore.getState().addToast({
          type: "success",
          title: t("canvas.runCompleted"),
          description: `Job ${result.jobId} ${t("canvas.runSuccess")}`,
        });
      },
      (error) => {
        toastStore.getState().addToast({
          type: "error",
          title: t("canvas.runFailed"),
          description: error,
        });
      }
    );

    set({ isRunning: false });
  },

  addNodeAndAutoConnect: (node) => {
    const state = get();
    state.addNode(node);

    if (state.connectStart) {
      const sourceNode = state.nodes.find((n) => n.id === state.connectStart!.nodeId);
      if (sourceNode) {
        if (state.connectStart.handleType === "source") {
          state.handleConnect({
            source: state.connectStart.nodeId,
            sourceHandle: state.connectStart.handleId,
            target: node.id,
            targetHandle: null,
          });
        } else {
          state.handleConnect({
            source: node.id,
            sourceHandle: null,
            target: state.connectStart.nodeId,
            targetHandle: state.connectStart.handleId,
          });
        }
      }
    }

    set({ connectStart: null, contextMenu: null, connectionMenu: null });
  },

  createObjectNode: (type) => {
    const { contextMenu } = get();
    if (!contextMenu) return;
    get().addNodeAndAutoConnect({
      id: `${type}-${Date.now()}`,
      type,
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: makeDefaultNodeData(type as BuiltinNodeType),
    });
  },

  createOperationNode: (operation) => {
    const { contextMenu } = get();
    if (!contextMenu) return;
    get().addNodeAndAutoConnect({
      id: `op-${operation.id}-${Date.now()}`,
      type: "operation",
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: makeOperationNodeData(operation),
    });
  },

  createRecipeNode: (recipe, operation) => {
    const { contextMenu } = get();
    if (!contextMenu) return;
    get().addNodeAndAutoConnect({
      id: `op-recipe-${Date.now()}`,
      type: "operation",
      position: { x: contextMenu.flowX, y: contextMenu.flowY },
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });
  },

  createObjectNodeAtViewportCenter: (type) => {
    const position = get().screenToFlowPosition(get().getViewportScreenCenter());
    get().addNodeAndAutoConnect({
      id: `${type}-${Date.now()}`,
      type,
      origin: QUICK_ADD_NODE_ORIGIN,
      position,
      data: makeDefaultNodeData(type as BuiltinNodeType),
    });
    set({ isQuickAddOpen: false });
  },

  createOperationNodeAtViewportCenter: (operation) => {
    const position = get().screenToFlowPosition(get().getViewportScreenCenter());
    get().addNodeAndAutoConnect({
      id: `op-${operation.id}-${Date.now()}`,
      type: "operation",
      origin: QUICK_ADD_NODE_ORIGIN,
      position,
      data: makeOperationNodeData(operation),
    });
    set({ isQuickAddOpen: false });
  },

  createRecipeNodeAtViewportCenter: (recipe, operation) => {
    const position = get().screenToFlowPosition(get().getViewportScreenCenter());
    get().addNodeAndAutoConnect({
      id: `op-recipe-${Date.now()}`,
      type: "operation",
      origin: QUICK_ADD_NODE_ORIGIN,
      position,
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });
    set({ isQuickAddOpen: false });
  },

  // TODO: Find if it should be use
  dismissContextMenu: () => {
    set({ connectStart: null, contextMenu: null });
  },

  handleContextMenuOpenChange: (open) => {
    if (!open) {
      set({ connectStart: null, contextMenu: null });
    }
  },

  connectObjectNode: (type) => {
    const { connectionMenu } = get();
    if (!connectionMenu) return;
    get().addNodeAndAutoConnect({
      id: `${type}-${Date.now()}`,
      type,
      position: offsetPosition(
        { x: connectionMenu.flowX, y: connectionMenu.flowY },
        CONNECTION_MENU_NODE_OFFSET
      ),
      data: makeDefaultNodeData(type as BuiltinNodeType),
    });
  },

  connectOperationNode: (operation) => {
    const { connectionMenu } = get();
    if (!connectionMenu) return;
    get().addNodeAndAutoConnect({
      id: `op-${operation.id}-${Date.now()}`,
      type: "operation",
      position: offsetPosition(
        { x: connectionMenu.flowX, y: connectionMenu.flowY },
        CONNECTION_MENU_NODE_OFFSET
      ),
      data: makeOperationNodeData(operation),
    });
  },

  connectRecipeNode: (recipe, operation) => {
    const { connectionMenu } = get();
    if (!connectionMenu) return;
    get().addNodeAndAutoConnect({
      id: `op-recipe-${Date.now()}`,
      type: "operation",
      position: offsetPosition(
        { x: connectionMenu.flowX, y: connectionMenu.flowY },
        CONNECTION_MENU_NODE_OFFSET
      ),
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });
  },

  dismissConnectionMenu: () => {
    set({ connectStart: null, connectionMenu: null });
  },

  handleConnectionMenuOpenChange: (open) => {
    if (!open) {
      set({ connectStart: null, connectionMenu: null });
    }
  },

  // ── Node context menu actions ──────────────────────────────────────────

  handleNodeContextMenuOpenChange: (open) => {
    if (!open) {
      set({ nodeContextMenu: null });
    }
  },

  nodeContextDuplicate: () => {
    const { nodeContextMenu } = get();
    if (!nodeContextMenu) return;
    get().duplicateNode(nodeContextMenu.nodeId);
    set({ nodeContextMenu: null });
  },

  nodeContextDelete: () => {
    const { nodeContextMenu } = get();
    if (!nodeContextMenu) return;
    get().removeNode(nodeContextMenu.nodeId);
    set({ nodeContextMenu: null });
  },

  nodeContextUngroup: () => {
    const { nodeContextMenu, ungroupCompound } = get();

    if (!nodeContextMenu) return;

    ungroupCompound(nodeContextMenu.nodeId);

    set({ nodeContextMenu: null });
  },

  nodeContextDetach: () => {
    const { nodeContextMenu, nodes } = get();
    if (!nodeContextMenu) return;
    const node = nodes.find((n) => n.id === nodeContextMenu.nodeId);
    if (node?.parentId) {
      get().removeNodeFromCompound(nodeContextMenu.nodeId, node.parentId);
    }
    set({ nodeContextMenu: null });
  },

  nodeContextGroupSelected: () => {
    const { nodes } = get();
    const selectedIds = nodes.filter((n) => n.selected && n.type !== "compound").map((n) => n.id);
    get().groupSelectedNodes(selectedIds);
    set({ nodeContextMenu: null });
  },

  nodeContextAddObject: (type) => {
    const { nodeContextMenu, nodes } = get();
    if (!nodeContextMenu) return;
    const node = nodes.find((n) => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    const newId = `${type}-${Date.now()}`;
    get().addNode({
      id: newId,
      type,
      position: offsetPosition(node.position, NODE_CONTEXT_CONNECT_OFFSET),
      data: makeDefaultNodeData(type as BuiltinNodeType),
    });
    get().handleConnect({
      source: nodeContextMenu.nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    set({ nodeContextMenu: null });
  },

  nodeContextAddOperation: (operation) => {
    const { nodeContextMenu, nodes } = get();
    if (!nodeContextMenu) return;
    const node = nodes.find((n) => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    const newId = `op-${operation.id}-${Date.now()}`;
    get().addNode({
      id: newId,
      type: "operation",
      position: offsetPosition(node.position, NODE_CONTEXT_CONNECT_OFFSET),
      data: makeOperationNodeData(operation),
    });
    get().handleConnect({
      source: nodeContextMenu.nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    set({ nodeContextMenu: null });
  },

  nodeContextAddRecipe: (recipe, operation) => {
    const { nodeContextMenu, nodes } = get();
    if (!nodeContextMenu) return;
    const node = nodes.find((n) => n.id === nodeContextMenu.nodeId);
    if (!node) return;
    const newId = `op-recipe-${Date.now()}`;
    get().addNode({
      id: newId,
      type: "operation",
      position: offsetPosition(node.position, NODE_CONTEXT_CONNECT_OFFSET),
      data: {
        ...makeOperationNodeData(operation),
        label: recipe.name,
        bestPracticeId: recipe.bestPracticeId,
        bestPracticeName: recipe.name,
      },
    });
    get().handleConnect({
      source: nodeContextMenu.nodeId,
      sourceHandle: null,
      target: newId,
      targetHandle: null,
    });
    set({ nodeContextMenu: null });
  },

  // ── Node data actions ──────────────────────────────────────────────────

  handleGitHubProjectPick: (nodeId, picked) => {
    get().updateNodeData(nodeId, {
      sourceType: "github",
      label: picked.label,
      owner: picked.owner,
      repo: picked.repo,
      branch: picked.branch,
      description: picked.description,
      isPrivate: picked.isPrivate,
      githubProjectId: picked.githubProjectId,
      localPath: undefined,
    });
  },

  handleGitHubProjectConnect: (nodeId, info) => {
    get().updateNodeData(nodeId, {
      sourceType: "github",
      label: info.label,
      owner: info.owner,
      repo: info.repo,
      branch: info.branch,
      description: info.description,
      githubProjectId: undefined,
      localPath: undefined,
    });
  },

  handleGitHubProjectLocalFolder: (nodeId, info) => {
    get().updateNodeData(nodeId, {
      sourceType: "local",
      label: info.label,
      localPath: info.localPath,
      owner: "",
      repo: "",
      branch: undefined,
      githubProjectId: undefined,
    });
  },

  handleNodeAddExcludedPath: (nodeId, path) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const data = node.data as Record<string, unknown>;
    const current = Array.isArray(data.excludedPaths) ? (data.excludedPaths as string[]) : [];
    if (!current.includes(path)) {
      get().updateNodeData(nodeId, { excludedPaths: [...current, path] });
    }
  },

  handleNodeRemoveExcludedPath: (nodeId, path) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const data = node.data as Record<string, unknown>;
    const current = Array.isArray(data.excludedPaths) ? (data.excludedPaths as string[]) : [];
    get().updateNodeData(nodeId, {
      excludedPaths: current.filter((p) => p !== path),
    });
  },
});
