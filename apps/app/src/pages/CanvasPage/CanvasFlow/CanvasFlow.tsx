import { useEffect, useMemo, useRef, type DragEvent, type Ref } from "react";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { useHotkeys } from "react-hotkeys-hook";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { ErrorNode } from "../ErrorNode";
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
import { SemanticEdge } from "../edges";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  decodeCanvasComponentDragPayload,
  hasCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { DEFAULT_CANVAS_VIEWPORT } from "../utils/canvasViewport";
import { decorateEdgesWithPortHandles } from "../NodeCard";
import type { PipelineEdge } from "../_store/canvasSlice";

// Must be defined outside the component to prevent React Flow infinite re-renders
const nodeTypes = {
  default: ErrorNode,
  operation: OperationNode,
  compound: CompoundNode,
  file: FileNode,
  folder: FolderNode,
  "github-project": GithubProjectNode,
  prompt: PromptNode,
  "output-project-path": OutputProjectPathNode,
  "output-local-path": OutputLocalPathNode,
};

const edgeTypes = {
  semantic: SemanticEdge,
};

const defaultEdgeOptions = {
  type: "semantic" as const,
  animated: true,
  style: { stroke: "#94a3b8", strokeWidth: 2 },
};

const proOpts = { hideAttribution: false };
const snapGrid: [number, number] = [24, 24];
const nodePortRemeasureDelayMs = 220;

interface CanvasFlowProps {
  viewportRef?: Ref<HTMLDivElement>;
}

const handleComponentDragOver = (event: DragEvent<HTMLDivElement>) => {
  if (!hasCanvasComponentDragPayload(event.dataTransfer.types)) {
    return;
  }

  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

export const CanvasFlow = ({ viewportRef }: CanvasFlowProps) => {
  const store = useCanvasPageStore();
  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);
  const connectStart = useStore(store, (s) => s.connectStart);
  const isCanvasInteractive = useStore(store, (s) => s.isCanvasInteractive);
  const portRoutedEdges = useMemo(
    () => decorateEdgesWithPortHandles(nodes, edges, connectStart),
    [connectStart, edges, nodes],
  );
  const semanticEdges = useMemo<PipelineEdge[]>(
    () => portRoutedEdges.map((edge) => ({ ...edge, type: "semantic" })),
    [portRoutedEdges],
  );
  const isConsoleOpen = useStore(store, (s) => s.isConsoleOpen);
  const canvasSettings = useStore(store, (s) => s.canvasSettings);
  const handleNodesChange = useStore(store, (s) => s.handleNodesChange);
  const handleEdgesChange = useStore(store, (s) => s.handleEdgesChange);
  const handleConnect = useStore(store, (s) => s.handleConnect);
  const handleUndo = useStore(store, (s) => s.handleUndo);
  const handleRedo = useStore(store, (s) => s.handleRedo);
  const handleFlowInit = useStore(store, (s) => s.handleFlowInit);
  const handleFlowConnectStart = useStore(store, (s) => s.handleFlowConnectStart);
  const handleFlowConnectEnd = useStore(store, (s) => s.handleFlowConnectEnd);
  const handleFlowNodeClick = useStore(store, (s) => s.handleFlowNodeClick);
  const handleFlowNodeContextMenu = useStore(store, (s) => s.handleFlowNodeContextMenu);
  const handleFlowEdgeClick = useStore(store, (s) => s.handleFlowEdgeClick);
  const handleFlowPaneClick = useStore(store, (s) => s.handleFlowPaneClick);
  const handleFlowPaneContextMenu = useStore(store, (s) => s.handleFlowPaneContextMenu);
  const handleCreateObjectNode = useStore(store, (s) => s.handleCreateObjectNode);
  const handleCreateOperationNode = useStore(store, (s) => s.handleCreateOperationNode);
  const handleCreateSkillOperationNode = useStore(store, (s) => s.handleCreateSkillOperationNode);
  const handleFlowNodeDrag = useStore(store, (s) => s.handleFlowNodeDrag);
  const handleFlowNodeDragStop = useStore(store, (s) => s.handleFlowNodeDragStop);
  const handleFlowMove = useStore(store, (s) => s.handleFlowMove);
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const latestNodeIdsRef = useRef(nodeIds);
  const pendingRemeasureRef = useRef<{
    frameId: number | null;
    timeoutId: ReturnType<typeof globalThis.setTimeout> | null;
  }>({
    frameId: null,
    timeoutId: null,
  });

  latestNodeIdsRef.current = nodeIds;

  const clearScheduledNodeInternalsUpdate = () => {
    const { frameId, timeoutId } = pendingRemeasureRef.current;

    if (frameId !== null && typeof cancelAnimationFrame !== "undefined") {
      cancelAnimationFrame(frameId);
    }

    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }

    pendingRemeasureRef.current = {
      frameId: null,
      timeoutId: null,
    };
  };

  const scheduleUpdateAllNodeInternals = () => {
    clearScheduledNodeInternalsUpdate();

    if (latestNodeIdsRef.current.length === 0) {
      return;
    }

    const runUpdate = () => {
      if (latestNodeIdsRef.current.length === 0) {
        return;
      }

      updateNodeInternals(latestNodeIdsRef.current);
    };

    const timeoutId = globalThis.setTimeout(() => {
      pendingRemeasureRef.current.timeoutId = null;
      runUpdate();
    }, nodePortRemeasureDelayMs);
    const frameId =
      typeof requestAnimationFrame === "undefined"
        ? null
        : requestAnimationFrame(() => {
            pendingRemeasureRef.current.frameId = null;
            runUpdate();
          });

    pendingRemeasureRef.current = {
      frameId,
      timeoutId,
    };
  };

  useEffect(
    () => () => {
      clearScheduledNodeInternalsUpdate();
    },
    [],
  );

  const interactiveHandlers = isCanvasInteractive
    ? {
        onConnect: (...args: Parameters<typeof handleConnect>) => {
          handleConnect(...args);
          scheduleUpdateAllNodeInternals();
        },
        onConnectEnd: (...args: Parameters<typeof handleFlowConnectEnd>) => {
          handleFlowConnectEnd(...args);
          scheduleUpdateAllNodeInternals();
        },
        onConnectStart: (...args: Parameters<typeof handleFlowConnectStart>) => {
          handleFlowConnectStart(...args);
          scheduleUpdateAllNodeInternals();
        },
        onEdgeClick: handleFlowEdgeClick,
        onNodeClick: handleFlowNodeClick,
        onNodeContextMenu: handleFlowNodeContextMenu,
        onNodeDrag: handleFlowNodeDrag,
        onNodeDragStop: handleFlowNodeDragStop,
        onPaneClick: handleFlowPaneClick,
        onPaneContextMenu: handleFlowPaneContextMenu,
      }
    : {};
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

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const payload = decodeCanvasComponentDragPayload(
      event.dataTransfer.getData(CANVAS_COMPONENT_DRAG_MIME),
    );
    if (!payload) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const screenPosition = { x: event.clientX, y: event.clientY };
    if (payload.kind === "object") {
      handleCreateObjectNode(payload.type, screenPosition);

      return;
    }

    if (payload.kind === "operation") {
      handleCreateOperationNode(payload.operation, screenPosition);

      return;
    }

    void handleCreateSkillOperationNode(payload.skill, screenPosition);
  };

  const handleNodesChangeWithInternals = (changes: Parameters<typeof handleNodesChange>[0]) => {
    handleNodesChange(changes);
    scheduleUpdateAllNodeInternals();
  };

  return (
    <div
      ref={viewportRef}
      className="h-full w-full"
      data-testid="canvas-flow-viewport"
      onDragOver={handleComponentDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        className="bg-slate-50/50"
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={DEFAULT_CANVAS_VIEWPORT}
        deleteKeyCode={isCanvasInteractive ? ["Backspace", "Delete"] : null}
        edges={semanticEdges}
        edgeTypes={edgeTypes}
        elementsSelectable={isCanvasInteractive}
        nodes={nodes}
        nodesConnectable={isCanvasInteractive}
        nodesDraggable={isCanvasInteractive}
        nodeTypes={nodeTypes}
        panOnDrag={isCanvasInteractive}
        proOptions={proOpts}
        snapGrid={snapGrid}
        snapToGrid={canvasSettings.snapToGrid}
        zoomOnDoubleClick={isCanvasInteractive}
        zoomOnPinch={isCanvasInteractive}
        zoomOnScroll={isCanvasInteractive}
        onEdgesChange={handleEdgesChange}
        onInit={handleFlowInit}
        onMove={(_event, viewport) => handleFlowMove(viewport.zoom)}
        onNodesChange={handleNodesChangeWithInternals}
        {...interactiveHandlers}
      >
        {canvasSettings.showBackground && (
          <Background
            color="#cbd5e1"
            gap={snapGrid[0]}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
        )}
        {canvasSettings.showControls && (
          <Controls
            showInteractive
            className="border-gray-200! bg-white! shadow-sm!"
            position="bottom-left"
          />
        )}
        {canvasSettings.showMiniMap && nodes.length > 1 && !isConsoleOpen && (
          <MiniMap
            pannable
            zoomable
            className="border border-border bg-background/90 shadow-sm"
            nodeBorderRadius={6}
            nodeColor="#94a3b8"
            position="bottom-right"
          />
        )}
      </ReactFlow>
    </div>
  );
};
