import { useRef, useState } from "react";
import { useCreate } from "@refinedev/core";
import { Result, ResultAsync } from "neverthrow";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import type { ExecutionInputAsset, ExecutionPortDefinition } from "@repo/schemas";
import { encodeExecutionFile } from "../../execution/files";
import { TextField } from "../ExecutionWorkspacePage/TextField";
import { InputAssetDetails } from "../ExecutionWorkspacePage/InputAssetDetails";

export const CanvasPublishedInputs = ({
  ports,
  drafts,
  onChange,
  disabled,
  onBusyChange,
}: {
  ports: ExecutionPortDefinition[];
  drafts: Record<string, string>;
  onChange: (drafts: Record<string, string>) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) => {
  const { mutateAsync } = useCreate<ExecutionInputAsset>({ mutationOptions: { retry: false } });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const upload = async (port: ExecutionPortDefinition, file: File) => {
    if (disabled || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    onBusyChange(true);
    const result = await ResultAsync.fromPromise(
      Promise.resolve().then(async () => {
        const previous =
          port.cardinality === "many" && drafts[port.id] !== undefined
            ? Result.fromThrowable(
                (): unknown => JSON.parse(drafts[port.id]!),
                () => new Error("请先修正文件引用数组。"),
              )()
            : null;
        if (
          previous?.isErr() ||
          (previous?.isOk() &&
            (!Array.isArray(previous.value) ||
              previous.value.some((entry) => typeof entry !== "string")))
        )
          throw new Error("请先修正文件引用数组。");
        const input = await encodeExecutionFile(file);
        const response = await mutateAsync({
          dataProviderName: "execution",
          resource: "input-assets",
          values: { ...input, mimeType: file.type || port.mimeTypes?.[0] || input.mimeType },
        });
        onChange({
          ...drafts,
          [port.id]:
            port.cardinality === "many"
              ? JSON.stringify([
                  ...(previous?.isOk() ? (previous.value as string[]) : []),
                  response.data.artifactId,
                ])
              : response.data.artifactId,
        });
      }),
      () => "文件导入失败，请重试。",
    );
    uploadLock.current = false;
    setUploading(false);
    onBusyChange(false);
    setError(result.isErr() ? result.error : null);
  };

  return (
    <fieldset
      disabled={disabled || uploading}
      className="space-y-4"
      aria-label="已发布 Pipeline 输入"
    >
      {ports.length === 0 && (
        <p className="text-sm text-muted-foreground">此 Pipeline 未定义外部输入。</p>
      )}
      {ports.map((port) => (
        <div key={port.id} className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <TextField
            label={`${port.id} · ${port.required ? "必填" : "可选"}`}
            value={drafts[port.id] ?? ""}
            multiline={port.valueType !== "artifact" || port.cardinality === "many"}
            onChange={(value) => onChange({ ...drafts, [port.id]: value })}
            hint={`${port.valueType} · ${port.cardinality === "many" ? "多值：JSON 数组，按顺序传递" : "单值"} · ${port.allowEmpty ? "允许空值" : "不允许空值"}${port.valueType === "artifact" ? "；填写 Artifact ID" : ""}`}
          />
          {!port.required && drafts[port.id] !== undefined && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange(
                  Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== port.id)),
                )
              }
            >
              不提供此可选输入
            </Button>
          )}
          {port.valueType === "artifact" && (
            <>
              <Label htmlFor={`canonical-file-${port.id}`}>
                导入文件（多值输入可填写 Artifact ID 数组）
              </Label>
              <Input
                id={`canonical-file-${port.id}`}
                type="file"
                accept={port.mimeTypes?.join(",")}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(port, file);
                  event.target.value = "";
                }}
              />
              {port.cardinality === "one" && drafts[port.id] && (
                <InputAssetDetails id={drafts[port.id]!} dataProviderName="execution" />
              )}
            </>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
};
