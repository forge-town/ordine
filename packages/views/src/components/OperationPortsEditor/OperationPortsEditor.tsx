import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TemplateContentTypeSchema, type InputPort, type OutputItem } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Textarea } from "@repo/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/select";
import {
  changeOperationInputType,
  createOperationInputPort,
  createOperationOutputPort,
  EditableInputPortsSchema,
  EditableOutputPortsSchema,
} from "./operationPortFields";

type OperationPortsEditorProps =
  | { direction: "input"; ports: InputPort[]; onChange: (ports: InputPort[]) => void }
  | { direction: "output"; ports: OutputItem[]; onChange: (ports: OutputItem[]) => void };

export const OperationPortsEditor = (props: OperationPortsEditorProps) => {
  const formId = useId();
  const title = props.direction === "input" ? "输入端口" : "输出端口";
  const validation =
    props.direction === "input"
      ? EditableInputPortsSchema.safeParse(props.ports)
      : EditableOutputPortsSchema.safeParse(props.ports);
  const handleAdd = () => {
    if (props.direction === "input")
      props.onChange([...props.ports, createOperationInputPort(props.ports)]);
    else props.onChange([...props.ports, createOperationOutputPort(props.ports)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground">
          {title} · {props.ports.length}
        </h3>
        <Button size="sm" type="button" variant="outline" onClick={handleAdd}>
          <Plus className="size-3.5" />
          添加
        </Button>
      </div>
      {props.ports.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          尚未配置{title}
        </p>
      )}
      {props.ports.map((port, index) => {
        const prefix = `${formId}-${index}`;
        const input = "kind" in port ? port : undefined;
        const output = "contentType" in port ? port : undefined;
        const typeValue =
          output?.contentType ??
          (input?.kind === "prompt" && input.accepts?.length === 1
            ? input.accepts[0] === "application/json"
              ? "json"
              : input.accepts[0] === "text/plain"
                ? "text"
                : null
            : null);
        const update = (patch: Partial<InputPort & OutputItem>) => {
          if (props.direction === "input")
            props.onChange(
              props.ports.map((value, position) =>
                position === index ? { ...value, ...patch } : value,
              ),
            );
          else
            props.onChange(
              props.ports.map((value, position) =>
                position === index ? { ...value, ...patch } : value,
              ),
            );
        };
        const handleRemove = () => {
          if (props.direction === "input")
            props.onChange(props.ports.filter((_, position) => position !== index));
          else props.onChange(props.ports.filter((_, position) => position !== index));
        };
        const handleIdChange = (event: React.ChangeEvent<HTMLInputElement>) =>
          update({ id: event.target.value });
        const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) =>
          update({ name: event.target.value });
        const handleDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          update({ description: event.target.value });
        const handleTypeChange = (value: string | null) => {
          if (props.direction === "input" && (value === "text" || value === "json")) {
            props.onChange(
              props.ports.map((item, position) =>
                position === index ? changeOperationInputType(item, value) : item,
              ),
            );
          } else if (props.direction === "output") {
            const parsed = TemplateContentTypeSchema.safeParse(value);
            if (parsed.success) update({ contentType: parsed.data });
          }
        };
        const handleRequiredChange = (value: string | null) => {
          if (value === "required" || value === "optional")
            update({ required: value === "required" });
        };
        const handleCardinalityChange = (value: string | null) => {
          if (value === "one" || value === "many") update({ cardinality: value });
        };
        const handleMimeChange = (event: React.FocusEvent<HTMLInputElement>) => {
          const values = event.currentTarget.value
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
          update(
            input
              ? { accepts: values.length > 0 ? values : undefined }
              : { produces: values.length > 0 ? values : undefined },
          );
        };

        return (
          <div key={index} className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
                {port.id || "需要补全稳定 ID"}
              </span>
              <Button
                aria-label={`删除${title} ${index + 1}`}
                size="icon"
                type="button"
                variant="ghost"
                onClick={handleRemove}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${prefix}-id`}>
                  稳定 ID
                </Label>
                <Input
                  className="h-8 bg-background font-mono text-xs"
                  id={`${prefix}-id`}
                  placeholder="请输入稳定端口 ID"
                  value={port.id ?? ""}
                  onChange={handleIdChange}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${prefix}-name`}>
                  显示名称
                </Label>
                <Input
                  className="h-8 bg-background text-xs"
                  id={`${prefix}-name`}
                  value={port.name}
                  onChange={handleNameChange}
                />
              </div>
            </div>
            {!port.id && (
              <p className="text-xs text-destructive">
                旧端口缺少 ID，请明确填写；已有连线不会自动重新绑定。
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${prefix}-type`}>
                  类型
                </Label>
                <Select value={typeValue} onValueChange={handleTypeChange}>
                  <SelectTrigger className="h-8 w-full bg-background text-xs" id={`${prefix}-type`}>
                    <SelectValue placeholder={input ? `现有 ${input.kind} / MIME` : "请选择"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(input ? ["text", "json"] : TemplateContentTypeSchema.options).map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${prefix}-required`}>
                  必需性
                </Label>
                <Select
                  value={
                    port.required === undefined ? null : port.required ? "required" : "optional"
                  }
                  onValueChange={handleRequiredChange}
                >
                  <SelectTrigger
                    className="h-8 w-full bg-background text-xs"
                    id={`${prefix}-required`}
                  >
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>
                    <SelectItem value="optional">Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor={`${prefix}-cardinality`}>
                  数量
                </Label>
                <Select value={port.cardinality ?? null} onValueChange={handleCardinalityChange}>
                  <SelectTrigger
                    className="h-8 w-full bg-background text-xs"
                    id={`${prefix}-cardinality`}
                  >
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one">One</SelectItem>
                    <SelectItem value="many">Many</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${prefix}-mime`}>
                MIME（逗号分隔）
              </Label>
              <Input
                key={(input?.accepts ?? output?.produces ?? []).join(",")}
                className="h-8 bg-background text-xs"
                defaultValue={(input?.accepts ?? output?.produces ?? []).join(", ")}
                id={`${prefix}-mime`}
                onBlur={handleMimeChange}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor={`${prefix}-description`}>
                描述
              </Label>
              <Textarea
                className="min-h-16 resize-y bg-background text-xs"
                id={`${prefix}-description`}
                value={port.description ?? ""}
                onChange={handleDescriptionChange}
              />
            </div>
            {output && output.templateIds.length > 0 && (
              <p className="break-all text-xs text-muted-foreground">
                已保留模板引用：{output.templateIds.join(", ")}
              </p>
            )}
          </div>
        );
      })}
      {!validation.success && (
        <p className="text-xs text-destructive" role="alert">
          {validation.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("；")}
        </p>
      )}
    </div>
  );
};
