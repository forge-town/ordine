import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { RuntimeNodeSchema } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { ExecutionCanvasNode } from "./ExecutionCanvasNode";
import { ExecutionVisualGroup } from "./ExecutionVisualGroup";
const nodeTypes = { execution: ExecutionCanvasNode, visual: ExecutionVisualGroup };
export const PipelineCanvas = () => {
  const { pipeline, operations, pinned, pinnedOperation, edit, store, state, busy } =
    useWorkspaceData();
  if (!pipeline) return null;
  const graph = pipeline.graph;
  if (graph.nodes.length > 0 && pinned.query.isLoading)
    return (
      <Card
        className="flex h-[560px] items-center justify-center p-5 text-sm text-muted-foreground"
        role="status"
        variant="surface"
      >
        正在读取固定 Operation 修订与端口…
      </Card>
    );
  const portDefinitions = new Map(
    graph.nodes.map((node) => [
      node.id,
      pinnedOperation(node.operation.operationId, node.operation.revision),
    ]),
  );
  const visibleEdges = graph.edges.filter(
    (edge) =>
      portDefinitions
        .get(edge.target.nodeId)
        ?.inputPorts.some((port) => port.id === edge.target.portId) &&
      (edge.source.kind === "input"
        ? graph.inputs.some((port) => port.id === edge.source.portId)
        : portDefinitions
            .get(edge.source.nodeId)
            ?.outputPorts.some((port) => port.id === edge.source.portId)),
  );

  const nodes: Node[] = graph.nodes.map((node, index) => {
    const operation = pinnedOperation(node.operation.operationId, node.operation.revision);

    return {
      id: node.id,
      type: "execution",
      position: pipeline.editor.nodePositions[node.id] ?? {
        x: 320 + (index % 3) * 320,
        y: Math.floor(index / 3) * 250 + 80,
      },
      selected: state.selectedNodeId === node.id,
      data: {
        label: operation?.name ?? node.operation.operationId,
        kind: operation?.executor.kind ?? "未知",
        revision: node.operation.revision,
        inputPorts: operation?.inputPorts ?? [],
        outputPorts: operation?.outputPorts ?? [],
        unresolved: !operation,
      },
    };
  });
  const inputNode: Node = {
    id: "pipeline-inputs",
    type: "execution",
    position: { x: 0, y: 80 },
    draggable: false,
    data: {
      label: "Pipeline 输入",
      kind: "typed input",
      inputPorts: [],
      outputPorts: graph.inputs,
    },
  };
  const groups: Node[] = pipeline.editor.groups.map((group) => {
    const members = nodes.filter((node) => group.nodeIds.includes(node.id));
    const x = (members.length > 0 ? Math.min(...members.map((node) => node.position.x)) : 0) - 20;
    const y = (members.length > 0 ? Math.min(...members.map((node) => node.position.y)) : 0) - 40;

    return {
      id: `visual-${group.id}`,
      type: "visual",
      position: { x, y },
      selectable: false,
      draggable: false,
      zIndex: -1,
      style: {
        width: Math.max(...members.map((node) => node.position.x + 280), x + 300) - x + 20,
        height: Math.max(...members.map((node) => node.position.y + 190), y + 210) - y + 20,
      },
      data: { label: group.label },
    };
  });
  const connect = (connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      !connection.sourceHandle ||
      !connection.targetHandle
    )
      return;
    const sourceNode = graph.nodes.find((node) => node.id === connection.source);
    const targetNode = graph.nodes.find((node) => node.id === connection.target);
    const sourcePort = (
      connection.source === "pipeline-inputs"
        ? graph.inputs
        : sourceNode
          ? pinnedOperation(sourceNode.operation.operationId, sourceNode.operation.revision)
              ?.outputPorts
          : []
    )?.find((port) => port.id === connection.sourceHandle);
    const targetPort =
      targetNode &&
      pinnedOperation(
        targetNode.operation.operationId,
        targetNode.operation.revision,
      )?.inputPorts.find((port) => port.id === connection.targetHandle);
    if (
      !sourcePort ||
      !targetPort ||
      sourcePort.valueType !== targetPort.valueType ||
      (sourcePort.cardinality === "many" && targetPort.cardinality === "one")
    ) {
      store.getState().patch({ error: "端口类型或数量不兼容，不能连接。" });

      return;
    }
    edit((current) => ({
      ...current,
      graph: {
        ...current.graph,
        edges: [
          ...current.graph.edges,
          {
            id: `edge-${crypto.randomUUID()}`,
            source:
              connection.source === "pipeline-inputs"
                ? { kind: "input", portId: connection.sourceHandle! }
                : { kind: "node", nodeId: connection.source!, portId: connection.sourceHandle! },
            target: { nodeId: connection.target!, portId: connection.targetHandle! },
            order: current.graph.edges.filter(
              (edge) =>
                edge.target.nodeId === connection.target &&
                edge.target.portId === connection.targetHandle,
            ).length,
          },
        ],
      },
    }));
  };
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    store.getState().patch({ tab: "operations" });
  const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void pinned.query.refetch();
  const handleConnect4: NonNullable<React.ComponentProps<typeof ReactFlow>["onConnect"]> = connect;
  const handleMoveEnd5: NonNullable<React.ComponentProps<typeof ReactFlow>["onMoveEnd"]> = (
    event,
    viewport,
  ) => event && edit((current) => ({ ...current, editor: { ...current.editor, viewport } }));
  const handleNodeClick6: NonNullable<React.ComponentProps<typeof ReactFlow>["onNodeClick"]> = (
    _event,
    node,
  ) => {
    if (graph.nodes.some((entry) => entry.id === node.id))
      store.getState().patch({ selectedNodeId: node.id });
  };
  const handleNodesChange7: NonNullable<React.ComponentProps<typeof ReactFlow>["onNodesChange"]> = (
    changes,
  ) => {
    const positions = changes.filter(
      (change) =>
        change.type === "position" &&
        change.position &&
        graph.nodes.some((node) => node.id === change.id),
    );
    if (positions.length > 0)
      edit((current) => ({
        ...current,
        editor: {
          ...current.editor,
          nodePositions: {
            ...current.editor.nodePositions,
            ...Object.fromEntries(
              positions.flatMap((change) =>
                change.type === "position" && change.position ? [[change.id, change.position]] : [],
              ),
            ),
          },
        },
      }));
  };

  return (
    <Card className="min-w-0 overflow-hidden" variant="surface">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Pipeline Canvas</h2>
            <p className="text-xs text-muted-foreground">
              拖动端口连线；位置与分组只影响编辑布局。
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {graph.nodes.length} 节点 · {graph.edges.length} 连接
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {operations.result.data.map((operation) => {
            const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
              edit((current) => ({
                ...current,
                graph: {
                  ...current.graph,
                  nodes: [
                    ...current.graph.nodes,
                    RuntimeNodeSchema.parse({
                      id: `node-${crypto.randomUUID()}`,
                      operation: { operationId: operation.id, revision: operation.revision },
                    }),
                  ],
                },
              }));

            return (
              <Button
                key={operation.id}
                disabled={busy || graph.nodes.length >= 200}
                size="sm"
                variant="outline"
                onClick={handleClick1}
              >
                + {operation.name} r{operation.revision}
              </Button>
            );
          })}
          {operations.result.data.length === 0 && (
            <Button variant="outline" onClick={handleClick2}>
              先创建 Operation
            </Button>
          )}
        </div>
        {pinned.query.error && (
          <p className="text-xs text-destructive" role="alert">
            固定修订读取失败：{pinned.query.error.message}
            <Button size="sm" variant="ghost" onClick={handleClick3}>
              重试修订
            </Button>
          </p>
        )}
      </div>
      <div aria-label="Pipeline 节点与端口画布" className="h-[460px] min-w-0">
        <ReactFlow
          fitView
          defaultViewport={pipeline.editor.viewport}
          edges={visibleEdges.map((edge) => ({
            id: edge.id,
            source: edge.source.kind === "input" ? "pipeline-inputs" : edge.source.nodeId,
            sourceHandle: edge.source.portId,
            target: edge.target.nodeId,
            targetHandle: edge.target.portId,
            label: `#${edge.order}${edge.condition ? " · 条件" : ""}`,
            markerEnd: { type: MarkerType.ArrowClosed },
          }))}
          maxZoom={2}
          minZoom={0.1}
          nodes={[...groups, inputNode, ...nodes]}
          nodesConnectable={!busy}
          nodesDraggable={!busy}
          nodeTypes={nodeTypes}
          onConnect={handleConnect4}
          onMoveEnd={handleMoveEnd5}
          onNodeClick={handleNodeClick6}
          onNodesChange={handleNodesChange7}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      {graph.nodes.length === 0 && (
        <p className="border-t border-border p-4 text-sm text-muted-foreground">
          从上方添加步骤，然后配置 Pipeline 输入和端口绑定。
        </p>
      )}
    </Card>
  );
};
