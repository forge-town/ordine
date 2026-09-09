import { useCreate } from "@refinedev/core";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Button } from "@repo/ui/button";
import {
  ExecutionJsonValueSchema,
  type ExecutionInputAsset,
  type ExecutionValue,
} from "@repo/schemas";
import { encodeExecutionFile } from "../../execution/files";
import { useWorkspaceData } from "./useWorkspaceData";
import { TextField } from "./TextField";
import { JsonField } from "./JsonField";
import { InputAssetDetails } from "./InputAssetDetails";
export const RunInputs = () => {
  const { pipeline, state, store, act, busy } = useWorkspaceData();
  const { mutateAsync } = useCreate<ExecutionInputAsset>({ mutationOptions: { retry: false } });
  if (!pipeline) return null;
  const setValues = (portId: string, values: ExecutionValue[]) =>
    store.getState().patch({ inputs: { ...store.getState().inputs, [portId]: values } });

  return (
    <div className="space-y-4">
      {pipeline.graph.inputs.length === 0 && (
        <p className="text-sm text-muted-foreground">此 Pipeline 未定义外部输入。</p>
      )}
      {pipeline.graph.inputs.map((port) => {
        const values = state.inputs[port.id] ?? [];
        const append = (value: ExecutionValue) =>
          setValues(
            port.id,
            port.cardinality === "one"
              ? [value]
              : [...(store.getState().inputs[port.id] ?? []), value],
          );
        const handleClick6: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
          append(
            port.valueType === "json" ? { kind: "json", value: {} } : { kind: "text", value: "" },
          );
        const handleChange7: NonNullable<React.ComponentProps<typeof Input>["onChange"]> = (
          event,
        ) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void act(
            "导入文件",
            async () => {
              const input = await encodeExecutionFile(file);

              return mutateAsync({
                resource: "input-assets",
                values: {
                  ...input,
                  mimeType: file.type || port.mimeTypes?.[0] || input.mimeType,
                },
              });
            },
            (response) => append({ kind: "artifact", artifactId: response.data.artifactId }),
          );
          event.target.value = "";
        };
        const handleClick8: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
          append({ kind: "artifact", artifactId: "" });

        return (
          <div key={port.id} className="space-y-3 rounded-lg bg-surface-2 p-3">
            <div>
              <h3 className="font-medium">
                {port.id} {port.required ? "· 必填" : "· 可选"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {port.valueType} · {port.cardinality === "many" ? "多值，按列表顺序传递" : "单值"} ·{" "}
                {port.allowEmpty ? "允许空值" : "不可为空"}
              </p>
            </div>
            {values.map((value, index) => {
              const handleChange1: NonNullable<
                React.ComponentProps<typeof TextField>["onChange"]
              > = (text) =>
                setValues(
                  port.id,
                  values.map((entry, current) =>
                    current === index ? { kind: "text", value: text } : entry,
                  ),
                );
              const handleCommit2: NonNullable<
                React.ComponentProps<typeof JsonField>["onCommit"]
              > = (json) =>
                setValues(
                  port.id,
                  values.map((entry, current) =>
                    current === index
                      ? ExecutionJsonValueSchema.parse({ kind: "json", value: json })
                      : entry,
                  ),
                );
              const handleChange3: NonNullable<
                React.ComponentProps<typeof TextField>["onChange"]
              > = (artifactId) =>
                setValues(
                  port.id,
                  values.map((entry, current) =>
                    current === index ? { kind: "artifact", artifactId } : entry,
                  ),
                );
              const handleClick4: NonNullable<
                React.ComponentProps<typeof Button>["onClick"]
              > = () =>
                setValues(
                  port.id,
                  values.filter((_, current) => current !== index),
                );
              const handleClick5: NonNullable<
                React.ComponentProps<typeof Button>["onClick"]
              > = () => {
                const reordered = [...values];
                [reordered[index - 1], reordered[index]] = [
                  reordered[index]!,
                  reordered[index - 1]!,
                ];
                setValues(port.id, reordered);
              };

              return (
                <div key={index} className="space-y-2 border-b border-border/70 pb-3">
                  {value.kind === "text" ? (
                    <TextField
                      multiline
                      label={`文本 ${index + 1}`}
                      value={value.value}
                      onChange={handleChange1}
                    />
                  ) : value.kind === "json" ? (
                    <JsonField
                      label={`JSON 输入 ${index + 1}`}
                      schema={ExecutionJsonValueSchema.shape.value}
                      value={value.value}
                      onCommit={handleCommit2}
                    />
                  ) : (
                    <>
                      <TextField
                        label="Artifact ID"
                        value={value.artifactId}
                        onChange={handleChange3}
                      />
                      <InputAssetDetails id={value.artifactId} />
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button disabled={busy} size="sm" variant="ghost" onClick={handleClick4}>
                      移除此值
                    </Button>
                    {index > 0 && (
                      <Button disabled={busy} size="sm" variant="ghost" onClick={handleClick5}>
                        上移
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {(port.cardinality === "many" || values.length === 0) &&
              port.valueType !== "artifact" && (
                <Button disabled={busy} size="sm" variant="outline" onClick={handleClick6}>
                  添加{port.valueType === "json" ? " JSON" : "文本"}输入
                </Button>
              )}
            {port.valueType === "artifact" && (
              <div className="space-y-2">
                <Label htmlFor={`upload-${port.id}`}>导入本地文件（最大 8 MiB）</Label>
                <Input
                  accept={port.mimeTypes?.join(",")}
                  disabled={busy}
                  id={`upload-${port.id}`}
                  type="file"
                  onChange={handleChange7}
                />
                <Button disabled={busy} size="sm" variant="ghost" onClick={handleClick8}>
                  使用已有 Artifact ID
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
