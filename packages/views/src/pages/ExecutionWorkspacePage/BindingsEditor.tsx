import { useState } from "react";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import type { RuntimeEdgeSource, RuntimeNodePortReference } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { ChoiceField } from "./ChoiceField";
import { TextField } from "./TextField";
import { ConditionEditor } from "./ConditionEditor";
export const BindingsEditor = () => {
  const { pipeline, pinnedOperation, edit, store, busy } = useWorkspaceData();
  const [sourceKey, setSource] = useState("none");
  const [targetKey, setTarget] = useState("none");
  const [outputKey, setOutput] = useState("none");
  if (!pipeline) return null;
  const sources = [
    ...pipeline.graph.inputs.map((port) => ({
      key: `input|${port.id}`,
      label: `Pipeline.${port.id} · ${port.valueType}`,
      port,
      source: { kind: "input" as const, portId: port.id },
    })),
    ...pipeline.graph.nodes.flatMap((node) => {
      const operation = pinnedOperation(node.operation.operationId, node.operation.revision);

      return (
        operation?.outputPorts.map((port) => ({
          key: `node|${node.id}|${port.id}`,
          label: `${operation.name}.${port.id} · ${port.valueType}`,
          port,
          source: { kind: "node" as const, nodeId: node.id, portId: port.id },
        })) ?? []
      );
    }),
  ];
  const targets = pipeline.graph.nodes.flatMap((node) => {
    const operation = pinnedOperation(node.operation.operationId, node.operation.revision);

    return (
      operation?.inputPorts.map((port) => ({
        key: `${node.id}|${port.id}`,
        label: `${operation.name}.${port.id} · ${port.valueType}`,
        port,
        target: { nodeId: node.id, portId: port.id },
      })) ?? []
    );
  });
  const source = sources.find((item) => item.key === sourceKey);
  const target = targets.find((item) => item.key === targetKey);
  const compatible =
    source &&
    target &&
    source.port.valueType === target.port.valueType &&
    !(source.port.cardinality === "many" && target.port.cardinality === "one");
  const add = () => {
    if (!source || !target || !compatible) return;
    if (
      pipeline.graph.edges.some(
        (edge) =>
          JSON.stringify(edge.source) === JSON.stringify(source.source) &&
          JSON.stringify(edge.target) === JSON.stringify(target.target),
      )
    ) {
      store.getState().patch({ error: "这组端口已存在绑定。" });

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
            source: source.source as RuntimeEdgeSource,
            target: target.target,
            order: current.graph.edges.filter(
              (edge) =>
                edge.target.nodeId === target.target.nodeId &&
                edge.target.portId === target.target.portId,
            ).length,
          },
        ],
      },
    }));
  };
  const handleChange1: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    value,
  ) => {
    setSource(value);
    setTarget("none");
  };
  const handleChange2: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> =
    setTarget;
  const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = add;
  const handleChange7: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> =
    setOutput;
  const handleClick8: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    const selected = sources.find((item) => item.key === outputKey);
    if (!selected || selected.source.kind !== "node") return;
    const source: RuntimeNodePortReference = {
      nodeId: selected.source.nodeId,
      portId: selected.source.portId,
    };
    edit((current) => ({
      ...current,
      graph: {
        ...current.graph,
        outputs: [
          ...current.graph.outputs,
          {
            port: { ...selected.port, id: `result${current.graph.outputs.length + 1}` },
            source,
          },
        ],
      },
    }));
  };

  return (
    <Card className="space-y-5 p-5" variant="surface">
      <h2 className="font-semibold">端口绑定与发布输出</h2>
      <fieldset className="space-y-4" disabled={busy}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <ChoiceField
            label="源端口"
            options={[
              { value: "none", label: "选择输入或节点输出" },
              ...sources.map((item) => ({ value: item.key, label: item.label })),
            ]}
            value={sourceKey}
            onChange={handleChange1}
          />
          <ChoiceField
            label="目标输入"
            options={[
              { value: "none", label: "选择目标节点端口" },
              ...targets.map((item) => ({
                value: item.key,
                label: item.label,
                disabled:
                  !source ||
                  source.port.valueType !== item.port.valueType ||
                  (source.port.cardinality === "many" && item.port.cardinality === "one"),
              })),
            ]}
            value={targetKey}
            onChange={handleChange2}
          />
          <Button className="self-end" disabled={!compatible} onClick={handleClick3}>
            添加绑定
          </Button>
        </div>
        {pipeline.graph.edges.length === 0 && (
          <p className="text-sm text-muted-foreground">尚无绑定。输入不会自动传给节点。</p>
        )}
        {pipeline.graph.edges.map((edge) => {
          const handleChange4: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
            value,
          ) =>
            edit((current) => ({
              ...current,
              graph: {
                ...current.graph,
                edges: current.graph.edges.map((item) =>
                  item.id === edge.id ? { ...item, order: Number(value) } : item,
                ),
              },
            }));
          const handleClick5: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
            edit((current) => ({
              ...current,
              graph: {
                ...current.graph,
                edges: current.graph.edges.filter((item) => item.id !== edge.id),
              },
            }));
          const handleChange6: NonNullable<
            React.ComponentProps<typeof ConditionEditor>["onChange"]
          > = (condition) =>
            edit((current) => ({
              ...current,
              graph: {
                ...current.graph,
                edges: current.graph.edges.map((item) =>
                  item.id === edge.id ? { ...item, condition } : item,
                ),
              },
            }));

          return (
            <div key={edge.id} className="space-y-3 rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 break-all text-sm">
                  {edge.source.kind === "input" ? "Pipeline" : edge.source.nodeId}.
                  {edge.source.portId} → {edge.target.nodeId}.{edge.target.portId}
                </span>
                <div className="w-24">
                  <TextField
                    label="顺序 order"
                    type="number"
                    value={edge.order}
                    onChange={handleChange4}
                  />
                </div>
                <Button variant="ghost" onClick={handleClick5}>
                  删除绑定
                </Button>
              </div>
              <details>
                <summary className="cursor-pointer text-sm">
                  条件：{edge.condition?.operator ?? "始终"}
                </summary>
                <div className="pt-3">
                  <ConditionEditor
                    value={edge.condition}
                    valueType={
                      sources.find(
                        (item) => JSON.stringify(item.source) === JSON.stringify(edge.source),
                      )?.port.valueType
                    }
                    onChange={handleChange6}
                  />
                </div>
              </details>
            </div>
          );
        })}
        <div className="border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-52 flex-1">
              <ChoiceField
                label="发布为 Pipeline 输出"
                options={[
                  { value: "none", label: "选择节点输出端口" },
                  ...sources
                    .filter((item) => item.source.kind === "node")
                    .map((item) => ({ value: item.key, label: item.label })),
                ]}
                value={outputKey}
                onChange={handleChange7}
              />
            </div>
            <Button disabled={outputKey === "none"} variant="outline" onClick={handleClick8}>
              添加发布输出
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {pipeline.graph.outputs.map((output, index) => {
              const handleChange9: NonNullable<
                React.ComponentProps<typeof TextField>["onChange"]
              > = (id) =>
                edit((current) => ({
                  ...current,
                  graph: {
                    ...current.graph,
                    outputs: current.graph.outputs.map((entry, i) =>
                      i === index ? { ...entry, port: { ...entry.port, id } } : entry,
                    ),
                  },
                }));
              const handleClick10: NonNullable<
                React.ComponentProps<typeof Button>["onClick"]
              > = () =>
                edit((current) => ({
                  ...current,
                  graph: {
                    ...current.graph,
                    outputs: current.graph.outputs.filter((_, i) => i !== index),
                  },
                }));

              return (
                <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <TextField
                    label="Pipeline 输出 ID"
                    value={output.port.id}
                    onChange={handleChange9}
                  />
                  <span className="break-all py-2 text-xs text-muted-foreground">
                    {output.source.nodeId}.{output.source.portId} · {output.port.valueType}
                  </span>
                  <Button variant="ghost" onClick={handleClick10}>
                    移除输出
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </fieldset>
    </Card>
  );
};
