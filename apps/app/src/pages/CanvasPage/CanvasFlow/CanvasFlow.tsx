import { useMemo, type Ref } from "react";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { useHotkeys } from "react-hotkeys-hook";
import { ReactFlow, Background, Controls, BackgroundVariant, MiniMap } from "@xyflow/react";
import { CompoundNode } from "../CompoundNode";
import { CodeFileNode } from "../CodeFileNode";
import { ErrorNode } from "../ErrorNode";
import { FolderNode } from "../FolderNode";
import { GitHubProjectNode } from "../GitHubProjectNode";
import { OperationNode } from "../OperationNode";
import { OutputProjectPathNode } from "../OutputProjectPathNode";
import { OutputLocalPathNode } from "../OutputLocalPathNode";
import { DEFAULT_CANVAS_VIEWPORT } from "../utils/canvasViewport";
import { decorateEdgesWithPortHandles } from "../NodeCard";

// Must be defined outside the component to prevent React Flow infinite re-renders
const nodeTypes = {
  default: ErrorNode,
  operation: OperationNode,
  compound: CompoundNode,
  "code-file": CodeFileNode,
  folder: FolderNode,
  "github-project": GitHubProjectNode,
  "output-project-path": OutputProjectPathNode,
  "output-local-path": OutputLocalPathNode,
};

const defaultEdgeOptions = {
  type: "default" as const,
  animated: true,
  style: { stroke: "#94a3b8", strokeWidth: 2 },
};

const proOpts = { hideAttribution: false };

interface CanvasFlowProps {
  viewportRef?: Ref<HTMLDivElement>;
}

export const CanvasFlow = ({ viewportRef }: CanvasFlowProps) => {
  const store = useHarnessCanvasStore();

  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);
  const connectStart = useStore(store, (s) => s.connectStart);
  const portRoutedEdges = useMemo(
    () => decorateEdgesWithPortHandles(nodes, edges, connectStart),
    [connectStart, edges, nodes]
  );
  const isConsoleOpen = useStore(store, (s) => s.isConsoleOpen);
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
  const handleFlowNodeDrag = useStore(store, (s) => s.handleFlowNodeDrag);
  const handleFlowNodeDragStop = useStore(store, (s) => s.handleFlowNodeDragStop);
  const handleFlowMove = useStore(store, (s) => s.handleFlowMove);

  useHotkeys(
    "mod+z",
    (e) => {
      e.preventDefault();
      handleUndo();
    },
    { preventDefault: false }
  );
  useHotkeys(
    "mod+shift+z, mod+y",
    (e) => {
      e.preventDefault();
      handleRedo();
    },
    { preventDefault: false }
  );

  return (
    <div ref={viewportRef} className="h-full w-full" data-testid="canvas-flow-viewport">
      <ReactFlow
        className="bg-slate-50/50"
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={DEFAULT_CANVAS_VIEWPORT}
        deleteKeyCode={["Backspace", "Delete"]}
        edges={portRoutedEdges}
        nodes={nodes}
        nodeTypes={nodeTypes}
        proOptions={proOpts}
        onConnect={handleConnect}
        onConnectEnd={handleFlowConnectEnd}
        onConnectStart={handleFlowConnectStart}
        onEdgeClick={handleFlowEdgeClick}
        onEdgesChange={handleEdgesChange}
        onInit={handleFlowInit}
        onMove={(_event, viewport) => handleFlowMove(viewport.zoom)}
        onNodeClick={handleFlowNodeClick}
        onNodeContextMenu={handleFlowNodeContextMenu}
        onNodeDrag={handleFlowNodeDrag}
        onNodeDragStop={handleFlowNodeDragStop}
        onNodesChange={handleNodesChange}
        onPaneClick={handleFlowPaneClick}
        onPaneContextMenu={handleFlowPaneContextMenu}
      >
        <Background color="#cbd5e1" gap={24} size={1.5} variant={BackgroundVariant.Dots} />
        <Controls
          showInteractive
          className="border-gray-200! bg-white! shadow-sm!"
          position="bottom-left"
        />
        {nodes.length > 1 && !isConsoleOpen && (
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
