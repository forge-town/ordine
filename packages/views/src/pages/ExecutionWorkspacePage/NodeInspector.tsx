import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import type { RuntimeNode } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { ChoiceField } from "./ChoiceField";
import { TextField } from "./TextField";
import { ToggleField } from "./ToggleField";
import { ExecutionOptionsEditor } from "./ExecutionOptionsEditor";
import { ConditionEditor } from "./ConditionEditor";
export const NodeInspector = () => {
  const { pipeline, state, store, operations, pinnedOperation, edit, busy } = useWorkspaceData();
  const node = pipeline?.graph.nodes.find((entry) => entry.id === state.selectedNodeId);
  if (!pipeline || !node)
    return (
      <Card className="p-5 text-sm text-muted-foreground" variant="surface">
        在画布中选择节点，编辑执行策略与固定修订。
      </Card>
    );
  const operation = pinnedOperation(node.operation.operationId, node.operation.revision);
  const latest = operations.result.data.find((entry) => entry.id === node.operation.operationId);
  const update = (patch: Partial<RuntimeNode>) =>
    edit((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.map((entry) =>
          entry.id === node.id ? { ...entry, ...patch } : entry,
        ),
      },
    }));
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    edit((current) => ({
      ...current,
      graph: {
        ...current.graph,
        nodes: current.graph.nodes.filter((entry) => entry.id !== node.id),
        edges: current.graph.edges.filter(
          (edge) =>
            edge.target.nodeId !== node.id &&
            !(edge.source.kind === "node" && edge.source.nodeId === node.id),
        ),
        outputs: current.graph.outputs.filter((output) => output.source.nodeId !== node.id),
      },
      editor: {
        ...current.editor,
        nodePositions: Object.fromEntries(
          Object.entries(current.editor.nodePositions).filter(([id]) => id !== node.id),
        ),
        groups: current.editor.groups.map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((id) => id !== node.id),
        })),
      },
    }));
    store.getState().patch({ selectedNodeId: null });
  };
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    if (!latest) return;

    return update({ operation: { operationId: latest.id, revision: latest.revision } });
  };
  const handleChange3: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    failurePolicy,
  ) => update({ failurePolicy: failurePolicy as RuntimeNode["failurePolicy"] });
  const handleChange4: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (value) =>
    update({ retry: { ...node.retry, maxAttempts: Number(value) } });
  const handleChange5: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (value) =>
    update({
      retry: {
        ...node.retry,
        retryableCodes: value
          .split(",")
          .map((code) => code.trim())
          .filter(Boolean),
      },
    });
  const handleChange6: NonNullable<React.ComponentProps<typeof ToggleField>["onChange"]> = (
    checkpoint,
  ) => update({ checkpoint });
  const handleChange7: NonNullable<
    React.ComponentProps<typeof ExecutionOptionsEditor>["onChange"]
  > = (executionOverrides) => update({ executionOverrides });
  const handleChange8: NonNullable<React.ComponentProps<typeof ToggleField>["onChange"]> = (
    enabled,
  ) =>
    update({
      loop: enabled
        ? {
            maxIterations: 2,
            until: {
              portId: operation!.outputPorts[0]!.id,
              condition: { operator: "non_empty", negate: false },
            },
            feedback: [],
          }
        : undefined,
    });
  const handleChange9: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (value) =>
    update({ loop: { ...node.loop!, maxIterations: Number(value) } });
  const handleChange10: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    portId,
  ) =>
    update({
      loop: {
        ...node.loop!,
        until: { portId, condition: { operator: "non_empty", negate: false } },
      },
    });
  const handleChange11: NonNullable<React.ComponentProps<typeof ConditionEditor>["onChange"]> = (
    condition,
  ) => {
    if (condition) update({ loop: { ...node.loop!, until: { ...node.loop!.until, condition } } });
  };
  const handleClick15: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    update({
      loop: {
        ...node.loop!,
        feedback: [
          ...node.loop!.feedback,
          {
            sourcePort: operation!.outputPorts[0]!.id,
            targetPort: operation!.inputPorts[0]!.id,
          },
        ],
      },
    });
  const handleChange16: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (id) =>
    edit((current) => ({
      ...current,
      editor: {
        ...current.editor,
        groups: current.editor.groups.map((group) => ({
          ...group,
          nodeIds:
            group.id === id
              ? [...group.nodeIds.filter((entry) => entry !== node.id), node.id]
              : group.nodeIds.filter((entry) => entry !== node.id),
        })),
      },
    }));
  const handleClick17: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    edit((current) => ({
      ...current,
      editor: {
        ...current.editor,
        groups: [
          ...current.editor.groups.map((group) => ({
            ...group,
            nodeIds: group.nodeIds.filter((entry) => entry !== node.id),
          })),
          {
            id: `group-${crypto.randomUUID()}`,
            label: `分组 ${current.editor.groups.length + 1}`,
            nodeIds: [node.id],
          },
        ],
      },
    }));

  return (
    <Card className="min-w-0 p-5" variant="surface">
      <fieldset className="space-y-4" disabled={busy}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{operation?.name ?? "修订待解析"}</h2>
            <p className="break-all text-xs text-muted-foreground">
              {node.id} · 固定 r{node.operation.revision}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={handleClick1}>
            删除节点
          </Button>
        </div>
        {latest && latest.revision > node.operation.revision && (
          <Button variant="outline" onClick={handleClick2}>
            显式升级到 r{latest.revision}（需重新检查连接）
          </Button>
        )}
        <ChoiceField
          label="失败策略"
          options={[
            { value: "required", label: "Required：失败则任务失败" },
            { value: "best_effort", label: "Best effort：保留警告并继续" },
          ]}
          value={node.failurePolicy}
          onChange={handleChange3}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="最大尝试次数（1–3）"
            type="number"
            value={node.retry.maxAttempts}
            onChange={handleChange4}
          />
          <TextField
            label="允许重试的错误码（逗号分隔）"
            value={node.retry.retryableCodes.join(", ")}
            onChange={handleChange5}
          />
        </div>
        <ToggleField checked={node.checkpoint} label="执行前 Checkpoint" onChange={handleChange6} />
        <details>
          <summary className="cursor-pointer font-medium">节点运行参数与超时</summary>
          <div className="pt-3">
            <ExecutionOptionsEditor
              node
              agent={operation?.executor.kind === "agent"}
              value={node.executionOverrides}
              onChange={handleChange7}
            />
          </div>
        </details>
        <ToggleField
          checked={Boolean(node.loop)}
          disabled={!operation?.outputPorts.length}
          label="有界循环"
          onChange={handleChange8}
        />
        {node.loop && (
          <div className="space-y-3 rounded-lg bg-surface-2 p-3">
            <TextField
              label="最大迭代数（1–20）"
              type="number"
              value={node.loop.maxIterations}
              onChange={handleChange9}
            />
            <ChoiceField
              label="终止条件输出端口"
              options={
                operation?.outputPorts.map((port) => ({
                  value: port.id,
                  label: `${port.id} · ${port.valueType}`,
                })) ?? []
              }
              value={node.loop.until.portId}
              onChange={handleChange10}
            />
            <ConditionEditor
              optional={false}
              value={node.loop.until.condition}
              valueType={
                operation?.outputPorts.find((port) => port.id === node.loop?.until.portId)
                  ?.valueType
              }
              onChange={handleChange11}
            />
            <h3 className="text-sm font-medium">循环反馈绑定</h3>
            {node.loop.feedback.map((binding, index) => {
              const handleChange12: NonNullable<
                React.ComponentProps<typeof ChoiceField>["onChange"]
              > = (sourcePort) =>
                update({
                  loop: {
                    ...node.loop!,
                    feedback: node.loop!.feedback.map((item, current) =>
                      current === index ? { ...item, sourcePort } : item,
                    ),
                  },
                });
              const handleChange13: NonNullable<
                React.ComponentProps<typeof ChoiceField>["onChange"]
              > = (targetPort) =>
                update({
                  loop: {
                    ...node.loop!,
                    feedback: node.loop!.feedback.map((item, current) =>
                      current === index ? { ...item, targetPort } : item,
                    ),
                  },
                });
              const handleClick14: NonNullable<
                React.ComponentProps<typeof Button>["onClick"]
              > = () =>
                update({
                  loop: {
                    ...node.loop!,
                    feedback: node.loop!.feedback.filter((_, current) => current !== index),
                  },
                });

              return (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <ChoiceField
                    label="源输出"
                    options={
                      operation?.outputPorts.map((port) => ({ value: port.id, label: port.id })) ??
                      []
                    }
                    value={binding.sourcePort}
                    onChange={handleChange12}
                  />
                  <ChoiceField
                    label="目标输入"
                    options={
                      operation?.inputPorts.map((port) => ({ value: port.id, label: port.id })) ??
                      []
                    }
                    value={binding.targetPort}
                    onChange={handleChange13}
                  />
                  <Button variant="ghost" onClick={handleClick14}>
                    移除
                  </Button>
                </div>
              );
            })}
            <Button
              disabled={!operation?.inputPorts.length || operation.outputPorts.length === 0}
              size="sm"
              variant="outline"
              onClick={handleClick15}
            >
              添加反馈绑定
            </Button>
          </div>
        )}
        <ChoiceField
          label="视觉分组（不参与执行）"
          options={[
            { value: "none", label: "不分组" },
            ...pipeline.editor.groups.map((group) => ({ value: group.id, label: group.label })),
          ]}
          value={
            pipeline.editor.groups.find((group) => group.nodeIds.includes(node.id))?.id ?? "none"
          }
          onChange={handleChange16}
        />
        <Button size="sm" variant="outline" onClick={handleClick17}>
          新建视觉分组
        </Button>
      </fieldset>
    </Card>
  );
};
