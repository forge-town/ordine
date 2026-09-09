import { Background, Controls, ReactFlow } from "@xyflow/react";
import type { PipelineDefinition } from "@repo/schemas";
import "@xyflow/react/dist/style.css";

export const CanvasPublishedGraph = ({ pipeline }: { pipeline: PipelineDefinition }) => {
  const nodes = [
    ...pipeline.graph.inputs.map((port, index) => ({
      id: `input:${port.id}`,
      position: { x: 0, y: index * 110 },
      data: { label: `输入 · ${port.id}\n${port.valueType} · ${port.cardinality}` },
      type: "input",
    })),
    ...pipeline.graph.nodes.map((node, index) => ({
      id: `node:${node.id}`,
      position: pipeline.editor.nodePositions[node.id] ?? {
        x: 300 + (index % 3) * 240,
        y: Math.floor(index / 3) * 130,
      },
      data: { label: `${node.id}\n${node.operation.operationId} · r${node.operation.revision}` },
    })),
  ];
  const edges = pipeline.graph.edges.map((edge) => ({
    id: edge.id,
    source:
      edge.source.kind === "input" ? `input:${edge.source.portId}` : `node:${edge.source.nodeId}`,
    target: `node:${edge.target.nodeId}`,
    label: `${edge.source.portId} → ${edge.target.portId}`,
    animated: false,
  }));

  return (
    <div
      className="h-80 overflow-hidden rounded-2xl border border-border bg-surface"
      aria-label="已发布 Pipeline 只读图"
      data-testid="canvas-published-graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
