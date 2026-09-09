import { useUpdate } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import {
  OperationRevisionSchema,
  type OperationRevision,
  type OperationExecutor,
} from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { newOperation } from "./_store";
import { TextField } from "./TextField";
import { ChoiceField } from "./ChoiceField";
import { PortsEditor } from "./PortsEditor";
import { ExecutionOptionsEditor } from "./ExecutionOptionsEditor";
export const OperationEditor = () => {
  const { state, store, operations, act, busy } = useWorkspaceData();
  const { mutateAsync } = useUpdate<OperationRevision>({ mutationOptions: { retry: false } });
  const draft = state.operationDraft;
  const change = (patch: Partial<OperationRevision>) => {
    if (draft) store.getState().patch({ operationDraft: { ...draft, ...patch } });
  };
  const executor = draft?.executor;
  const setBuiltin = (
    name: Extract<
      OperationExecutor,
      {
        kind: "builtin";
      }
    >["name"],
  ) => {
    if (!draft) return;
    const base = { cardinality: "one" as const, required: true, allowEmpty: false };
    change({
      executor: {
        kind: "builtin",
        name,
        config:
          name === "write_artifact"
            ? { name: "report.txt", mimeType: "text/plain" }
            : name === "merge_text"
              ? { separator: "\n\n" }
              : name === "materialize_file"
                ? { assetId: "" }
                : {},
      },
      inputPorts:
        name === "materialize_file"
          ? []
          : [
              {
                ...base,
                id: "input",
                valueType: name === "read_artifact" ? "artifact" : "text",
                cardinality: name === "merge_text" ? "many" : "one",
              },
            ],
      outputPorts: [
        {
          ...base,
          id: "output",
          valueType: name === "write_artifact" || name === "materialize_file" ? "artifact" : "text",
        },
      ],
    });
  };
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    store.getState().patch({ operationDraft: newOperation() });
  const handleClick2: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    void operations.query.refetch();
  const handleClick4: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () => {
    if (!draft) return;

    return void act(
      "保存 Operation",
      () =>
        mutateAsync({
          resource: "operations",
          id: draft.id,
          values: {
            apiVersion: 2,
            expectedRevision: draft.revision,
            operation: OperationRevisionSchema.parse({
              ...draft,
              revision: draft.revision + 1,
            }),
          },
        }),
      (response) => {
        store.getState().patch({
          operationDraft: response.data,
          notice: `已保存 Operation r${response.data.revision}`,
        });
        void operations.query.refetch();
      },
    );
  };
  const handleChange5: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (name) =>
    change({ name });
  const handleChange6: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    kind,
  ) => {
    if (kind === "builtin") setBuiltin("identity");
    else
      change({
        executor:
          kind === "script"
            ? {
                kind: "script",
                language: "javascript",
                source: 'console.log("Hello");',
                outputMode: "text",
              }
            : { kind: "agent", instruction: "", allowedTools: [] },
      });
  };
  const handleChange7: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    description,
  ) => change({ description });
  const handleChange8: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    language,
  ) => {
    if (executor?.kind !== "script") return;

    return change({
      executor: { ...executor, language: language as typeof executor.language },
    });
  };
  const handleChange9: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    outputMode,
  ) => {
    if (executor?.kind !== "script") return;

    return change({
      executor: {
        ...executor,
        outputMode: outputMode as typeof executor.outputMode,
      },
      ...(outputMode !== "manifest"
        ? {
            outputPorts: [
              {
                id: "output",
                valueType: outputMode as "text" | "json",
                cardinality: "one",
                required: true,
                allowEmpty: false,
              },
            ],
          }
        : {}),
    });
  };
  const handleChange10: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    source,
  ) => {
    if (executor?.kind !== "script") return;

    return change({ executor: { ...executor, source } });
  };
  const handleChange11: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    instruction,
  ) => {
    if (executor?.kind !== "agent") return;

    return change({ executor: { ...executor, instruction } });
  };
  const handleChange12: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    systemPrompt,
  ) => {
    if (executor?.kind !== "agent") return;

    return change({ executor: { ...executor, systemPrompt: systemPrompt || undefined } });
  };
  const handleChange13: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    value,
  ) => {
    if (executor?.kind !== "builtin") return;

    return setBuiltin(value as typeof executor.name);
  };
  const handleChange15: NonNullable<React.ComponentProps<typeof PortsEditor>["onChange"]> = (
    inputPorts,
  ) => change({ inputPorts });
  const handleChange16: NonNullable<React.ComponentProps<typeof PortsEditor>["onChange"]> = (
    outputPorts,
  ) => change({ outputPorts });
  const handleChange17: NonNullable<
    React.ComponentProps<typeof ExecutionOptionsEditor>["onChange"]
  > = (executionDefaults) => change({ executionDefaults });

  return (
    <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
      <Card className="space-y-3 p-4" variant="surface">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Operations</h2>
          <Button disabled={busy} size="sm" onClick={handleClick1}>
            新建
          </Button>
        </div>
        {operations.query.isLoading && <p role="status">正在加载…</p>}
        {operations.query.error && (
          <p className="text-sm text-destructive" role="alert">
            {operations.query.error.message}
            <Button variant="ghost" onClick={handleClick2}>
              重试
            </Button>
          </p>
        )}
        {operations.result.data.length === 0 && !operations.query.isLoading && (
          <p className="text-sm text-muted-foreground">
            创建可复用的执行步骤。每次保存都会产生新修订。
          </p>
        )}
        {operations.result.data.map((operation) => {
          const handleClick3: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
            store.getState().patch({ operationDraft: structuredClone(operation) });

          return (
            <Button
              key={operation.id}
              className="h-auto w-full justify-start whitespace-normal text-left"
              variant={draft?.id === operation.id ? "secondary" : "ghost"}
              onClick={handleClick3}
            >
              <span>
                {operation.name}
                <span className="block text-xs text-muted-foreground">
                  {operation.executor.kind} · r{operation.revision}
                </span>
              </span>
            </Button>
          );
        })}
      </Card>
      <Card className="min-w-0 p-5" variant="surface">
        {!draft ? (
          <p className="py-12 text-center text-muted-foreground">
            选择或新建一个 Operation，配置执行方式与端口。
          </p>
        ) : (
          <fieldset className="space-y-5" disabled={busy}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  {draft.revision === 0 ? "创建 Operation" : `编辑新修订 r${draft.revision + 1}`}
                </h2>
                <p className="text-xs text-muted-foreground">
                  已发布 r{draft.revision} 保持不可变；Pipeline 引用不会自动升级。
                </p>
              </div>
              <Button onClick={handleClick4}>保存新修订</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Operation 名称" value={draft.name} onChange={handleChange5} />
              <ChoiceField
                label="执行方式"
                options={[
                  { value: "builtin", label: "内置处理" },
                  { value: "script", label: "脚本" },
                  { value: "agent", label: "Agent 指令" },
                ]}
                value={executor?.kind ?? "builtin"}
                onChange={handleChange6}
              />
            </div>
            <TextField multiline label="说明" value={draft.description} onChange={handleChange7} />
            {executor?.kind === "script" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <ChoiceField
                    label="脚本语言"
                    options={[
                      { value: "javascript", label: "JavaScript" },
                      { value: "python", label: "Python" },
                      { value: "bash", label: "Bash" },
                    ]}
                    value={executor.language}
                    onChange={handleChange8}
                  />
                  <ChoiceField
                    label="输出格式"
                    options={[
                      { value: "text", label: "标准输出 → 单文本端口" },
                      { value: "json", label: "标准输出 → 单 JSON 端口" },
                      { value: "manifest", label: "显式 Artifact Manifest" },
                    ]}
                    value={executor.outputMode}
                    onChange={handleChange9}
                  />
                </div>
                <TextField
                  multiline
                  hint="stdin 是含 inputs、sharedContext、artifactFiles 的 v2 JSON。脚本运行须经用户审批；文件只能通过明确的 manifest 注册。"
                  label="脚本源码"
                  value={executor.source}
                  onChange={handleChange10}
                />
              </div>
            )}
            {executor?.kind === "agent" && (
              <div className="space-y-3">
                <TextField
                  multiline
                  label="Agent 指令"
                  value={executor.instruction}
                  onChange={handleChange11}
                />
                <TextField
                  multiline
                  label="系统提示词（可选）"
                  value={executor.systemPrompt ?? ""}
                  onChange={handleChange12}
                />
                <p className="text-sm text-muted-foreground">
                  当前适配器支持单个 text 或 JSON 输出。外部工具、Skill 引用与内嵌图片暂不支持。
                </p>
              </div>
            )}
            {executor?.kind === "builtin" && (
              <div className="space-y-3">
                <ChoiceField
                  label="内置操作"
                  options={[
                    { value: "identity", label: "原样传递" },
                    { value: "merge_text", label: "合并文本" },
                    { value: "write_artifact", label: "写出文件" },
                    { value: "read_artifact", label: "读取文件为文本" },
                    { value: "materialize_file", label: "物化已导入文件" },
                  ]}
                  value={executor.name}
                  onChange={handleChange13}
                />
                {(executor.name === "write_artifact"
                  ? ["name", "mimeType"]
                  : executor.name === "merge_text"
                    ? ["separator"]
                    : executor.name === "materialize_file"
                      ? ["assetId"]
                      : []
                ).map((key) => {
                  const handleChange14: NonNullable<
                    React.ComponentProps<typeof TextField>["onChange"]
                  > = (value) =>
                    change({
                      executor: { ...executor, config: { ...executor.config, [key]: value } },
                    });

                  return (
                    <TextField
                      key={key}
                      label={
                        {
                          name: "文件名",
                          mimeType: "MIME 类型",
                          separator: "文本分隔符",
                          assetId: "已导入 Asset ID",
                        }[key] ?? key
                      }
                      value={String(executor.config[key] ?? "")}
                      onChange={handleChange14}
                    />
                  );
                })}
              </div>
            )}
            <PortsEditor label="输入端口" ports={draft.inputPorts} onChange={handleChange15} />
            <PortsEditor label="输出端口" ports={draft.outputPorts} onChange={handleChange16} />
            <details>
              <summary className="cursor-pointer font-medium">Operation 执行默认值</summary>
              <div className="pt-3">
                <ExecutionOptionsEditor
                  node
                  agent={executor?.kind === "agent"}
                  value={draft.executionDefaults}
                  onChange={handleChange17}
                />
              </div>
            </details>
          </fieldset>
        )}
      </Card>
    </div>
  );
};
