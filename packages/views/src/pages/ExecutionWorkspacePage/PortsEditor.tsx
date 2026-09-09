import { Button } from "@repo/ui/button";
import { ExecutionJsonObjectSchema, type ExecutionPortDefinition } from "@repo/schemas";
import { TextField } from "./TextField";
import { ChoiceField } from "./ChoiceField";
import { ToggleField } from "./ToggleField";
import { JsonField } from "./JsonField";
export const PortsEditor = ({
  label,
  ports,
  onChange,
}: {
  label: string;
  ports: ExecutionPortDefinition[];
  onChange: (ports: ExecutionPortDefinition[]) => void;
}) => {
  const update = (index: number, patch: Partial<ExecutionPortDefinition>) =>
    onChange(ports.map((port, current) => (current === index ? { ...port, ...patch } : port)));
  const handleClick1: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
    onChange([
      ...ports,
      {
        id: `port${ports.length + 1}`,
        valueType: "text",
        cardinality: "one",
        required: true,
        allowEmpty: false,
      },
    ]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{label}</h3>
        <Button disabled={ports.length >= 64} size="sm" variant="outline" onClick={handleClick1}>
          添加端口
        </Button>
      </div>
      {ports.length === 0 && <p className="text-sm text-muted-foreground">暂未定义端口。</p>}
      {ports.map((port, index) => {
        const handleChange2: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
          id,
        ) => update(index, { id });
        const handleChange3: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
          kind,
        ) =>
          update(index, {
            valueType: kind as ExecutionPortDefinition["valueType"],
            jsonSchema: undefined,
            mimeTypes: undefined,
          });
        const handleChange4: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
          cardinality,
        ) => update(index, { cardinality: cardinality as "one" | "many" });
        const handleChange5: NonNullable<React.ComponentProps<typeof ToggleField>["onChange"]> = (
          required,
        ) => update(index, { required });
        const handleChange6: NonNullable<React.ComponentProps<typeof ToggleField>["onChange"]> = (
          allowEmpty,
        ) => update(index, { allowEmpty });
        const handleClick7: NonNullable<React.ComponentProps<typeof Button>["onClick"]> = () =>
          onChange(ports.filter((_, current) => current !== index));
        const handleChange8: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
          value,
        ) =>
          update(index, {
            mimeTypes: value
              ? value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
          });
        const handleCommit9: NonNullable<React.ComponentProps<typeof JsonField>["onCommit"]> = (
          value,
        ) => update(index, { jsonSchema: ExecutionJsonObjectSchema.parse(value) });

        return (
          <div key={index} className="space-y-3 rounded-lg bg-surface-2 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField label="端口 ID" value={port.id} onChange={handleChange2} />
              <ChoiceField
                label="值类型"
                options={[
                  { value: "text", label: "文本" },
                  { value: "json", label: "JSON" },
                  { value: "artifact", label: "文件 / Artifact" },
                  { value: "image-inline", label: "内嵌图片（不支持）", disabled: true },
                ]}
                value={port.valueType}
                onChange={handleChange3}
              />
              <ChoiceField
                label="数量"
                options={[
                  { value: "one", label: "单值" },
                  { value: "many", label: "多值（按顺序）" },
                ]}
                value={port.cardinality}
                onChange={handleChange4}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <ToggleField checked={port.required} label="必填" onChange={handleChange5} />
              <ToggleField checked={port.allowEmpty} label="允许空值" onChange={handleChange6} />
              <Button size="sm" variant="ghost" onClick={handleClick7}>
                移除端口
              </Button>
            </div>
            {port.valueType === "artifact" && (
              <TextField
                label="MIME 限制（逗号分隔，可留空）"
                value={port.mimeTypes?.join(", ") ?? ""}
                onChange={handleChange8}
              />
            )}
            {port.valueType === "json" && (
              <JsonField
                label="JSON Schema（可选）"
                schema={ExecutionJsonObjectSchema}
                value={port.jsonSchema ?? {}}
                onCommit={handleCommit9}
              />
            )}
          </div>
        );
      })}
    </section>
  );
};
