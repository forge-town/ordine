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
import { CompoundNode } from "../CompoundNode";
import { FileNode } from "../FileNode";
import { ErrorNode } from "../ErrorNode";
import { FolderNode } from "../FolderNode";
import { GitHubProjectNode } from "../GitHubProjectNode";
import { OperationNode } from "../OperationNode";
import { PromptNode } from "../PromptNode";
import { OutputProjectPathNode } from "../OutputProjectPathNode";
import { OutputLocalPathNode } from "../OutputLocalPathNode";
import {
  CANVAS_COMPONENT_DRAG_MIME,
  decodeCanvasComponentDragPayload,
  hasCanvasComponentDragPayload,
} from "../utils/canvasComponentDragPayload";
import { DEFAULT_CANVAS_VIEWPORT } from "../utils/canvasViewport";
import { decorateEdgesWithPortHandles } from "../NodeCard";
import { SemanticEdge } from "../SemanticEdge";

// Must be defined outside the component to prevent React Flow infinite re-renders
const nodeTypes = {
  default: ErrorNode,
  operation: OperationNode,
  compound: CompoundNode,
  file: FileNode,
  folder: FolderNode,
  "github-project": GitHubProjectNode,
  prompt: PromptNode,
  "output-project-path": OutputProjectPathNode,
  "output-local-path": OutputLocalPathNode,
};

const edgeTypes = {
  semantic: SemanticEdge,
};

const defaultEdgeOptions = {
  type: "semantic" as const,
};

const proOpts = { hideAttribution: true };
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
  const canvasTool = useStore(store, (s) => s.canvasTool);
  const portRoutedEdges = useMemo(
    () => decorateEdgesWithPortHandles(nodes, edges, connectStart),
    [connectStart, edges, nodes],
  );
  const semanticEdges = useMemo<typeof portRoutedEdges>(
    () => portRoutedEdges.map((edge) => ({ ...edge, animated: false, type: "semantic" as const })),
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
  const handleFlowNodeDragStart = useStore(store, (s) => s.handleFlowNodeDragStart);
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
        onNodeDragStart: handleFlowNodeDragStart,
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
      className="canvas-container h-full w-full"
      data-testid="canvas-flow-viewport"
      onDragOver={handleComponentDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        className="bg-canvas"
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={DEFAULT_CANVAS_VIEWPORT}
        deleteKeyCode={isCanvasInteractive ? ["Backspace", "Delete"] : null}
        edges={semanticEdges}
        edgeTypes={edgeTypes}
        elementsSelectable={isCanvasInteractive}
        minZoom={0.1}
        nodes={nodes}
        nodesConnectable={isCanvasInteractive}
        nodesDraggable={isCanvasInteractive}
        nodeTypes={nodeTypes}
        panOnDrag={isCanvasInteractive ? (canvasTool === "hand" ? true : [1, 2]) : false}
        panOnScroll={false}
        proOptions={proOpts}
        selectionOnDrag={isCanvasInteractive && canvasTool === "select"}
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
            color="var(--canvas-dot)"
            gap={snapGrid[0]}
            size={1.5}
            variant={BackgroundVariant.Dots}
          />
        )}
        {canvasSettings.showControls && (
          <Controls
            showInteractive
            className="border-border! bg-surface! text-foreground! shadow-soft!"
            position="bottom-left"
          />
        )}
        {canvasSettings.showMiniMap && nodes.length > 1 && !isConsoleOpen && (
          <MiniMap
            pannable
            zoomable
            className="border border-border bg-surface/90 shadow-soft"
            nodeBorderRadius={6}
            nodeColor="var(--muted-foreground)"
            position="bottom-right"
          />
        )}
      </ReactFlow>
    </div>
  );
};
