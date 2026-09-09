import type { ExecutionOverrides } from "@repo/schemas";
import { useWorkspaceData } from "./useWorkspaceData";
import { ChoiceField } from "./ChoiceField";
import { TextField } from "./TextField";
export const ExecutionOptionsEditor = ({
  value,
  onChange,
  node = false,
  agent = true,
}: {
  value: ExecutionOverrides;
  onChange: (value: ExecutionOverrides) => void;
  node?: boolean;
  agent?: boolean;
}) => {
  const { runtimes } = useWorkspaceData();
  const runtime = runtimes.result.data.find(
    (entry) => entry.config.id === value.runtimeConfigId,
  )?.config;
  const models = runtime?.connection.mode === "local" ? (runtime.connection.models ?? []) : [];
  const model = models.find((entry) => entry.id === value.model);
  const change = (key: keyof ExecutionOverrides, next: string | number | undefined) =>
    onChange({ ...value, [key]: next });
  const timeouts = [
    { key: "firstOutputTimeoutMs", label: "首次输出超时（ms）", hint: "0 = 关闭；留空继承" },
    { key: "inactivityTimeoutMs", label: "无活动超时（ms）" },
    ...(node
      ? []
      : [
          { key: "activeRunTimeoutMs", label: "Job 活动预算（ms）" },
          { key: "waitingTimeoutMs", label: "等待预算（ms）" },
        ]),
  ];
  const handleChange1: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    runtimeConfigId,
  ) =>
    onChange({
      ...value,
      runtimeConfigId: runtimeConfigId === "inherit" ? undefined : runtimeConfigId,
      model: undefined,
      reasoningEffort: undefined,
      speed: undefined,
    });
  const handleChange2: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    model,
  ) =>
    onChange({
      ...value,
      model: model === "inherit" ? undefined : model,
      reasoningEffort: undefined,
      speed: undefined,
    });
  const handleChange3: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    value,
  ) => change("reasoningEffort", value === "inherit" ? undefined : value);
  const handleChange4: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    value,
  ) => change("speed", value === "inherit" ? undefined : value);

  return (
    <div className="space-y-3">
      {agent && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceField
            label="运行环境"
            options={[
              { value: "inherit", label: "继承默认配置" },
              ...runtimes.result.data.map((entry) => ({
                value: entry.config.id,
                label: `${entry.config.name} · r${entry.revision}`,
                disabled:
                  entry.config.connection.mode !== "local" ||
                  entry.config.compatibility?.supportLevel === "unsupported",
              })),
            ]}
            value={value.runtimeConfigId ?? "inherit"}
            onChange={handleChange1}
          />
          <ChoiceField
            disabled={Boolean(runtime) && models.length === 0}
            hint={
              runtime && models.length === 0 ? "模型能力未知，不能选用未经发现的模型" : undefined
            }
            label="模型"
            options={[
              { value: "inherit", label: "继承默认模型" },
              ...models.map((entry) => ({ value: entry.id, label: entry.displayName })),
            ]}
            value={value.model ?? "inherit"}
            onChange={handleChange2}
          />
          <ChoiceField
            disabled={!model?.reasoningEfforts?.length}
            label="推理强度"
            options={[
              { value: "inherit", label: "继承" },
              ...(model?.reasoningEfforts?.map((item) => ({
                value: item.value,
                label: item.label ?? item.value,
              })) ?? []),
            ]}
            value={value.reasoningEffort ?? "inherit"}
            onChange={handleChange3}
          />
          <ChoiceField
            disabled={!model?.speeds?.length}
            label="速度"
            options={[
              { value: "inherit", label: "继承" },
              ...(model?.speeds?.map((item) => ({
                value: item.value,
                label: item.label ?? item.value,
              })) ?? []),
            ]}
            value={value.speed ?? "inherit"}
            onChange={handleChange4}
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {timeouts.map((field) => {
          const handleChange5: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
            next,
          ) =>
            change(field.key as keyof ExecutionOverrides, next === "" ? undefined : Number(next));

          return (
            <TextField
              key={field.key}
              hint={field.hint ?? "留空继承；必须大于 0"}
              label={field.label}
              type="number"
              value={value[field.key as keyof ExecutionOverrides] ?? ""}
              onChange={handleChange5}
            />
          );
        })}
      </div>
    </div>
  );
};
