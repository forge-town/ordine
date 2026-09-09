import { ExecutionValueSchema, type ExecutionCondition } from "@repo/schemas";
import { ChoiceField } from "./ChoiceField";
import { TextField } from "./TextField";
import { ToggleField } from "./ToggleField";
import { JsonField } from "./JsonField";
export const ConditionEditor = ({
  value,
  onChange,
  valueType = "text",
  optional = true,
}: {
  value?: ExecutionCondition;
  onChange: (value: ExecutionCondition | undefined) => void;
  valueType?: "text" | "json" | "artifact";
  optional?: boolean;
}) => {
  const handleChange1: NonNullable<React.ComponentProps<typeof ChoiceField>["onChange"]> = (
    operator,
  ) =>
    onChange(
      operator === "always"
        ? undefined
        : operator === "non_empty"
          ? { operator, negate: false }
          : operator === "contains"
            ? { operator, expected: "", negate: false }
            : {
                operator: "equals",
                expected:
                  valueType === "json"
                    ? { kind: "json", value: {} }
                    : valueType === "artifact"
                      ? { kind: "artifact", artifactId: "" }
                      : { kind: "text", value: "" },
                negate: false,
              },
    );
  const handleChange2: NonNullable<React.ComponentProps<typeof ToggleField>["onChange"]> = (
    negate,
  ) => {
    if (!value) return;

    return onChange({ ...value, negate });
  };
  const handleChange3: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    expected,
  ) => {
    if (value?.operator !== "contains") return;

    return onChange({ ...value, expected });
  };
  const handleCommit4: NonNullable<React.ComponentProps<typeof JsonField>["onCommit"]> = (next) => {
    if (value?.operator !== "equals") return;

    return onChange({
      ...value,
      expected: ExecutionValueSchema.parse({ kind: "json", value: next }),
    });
  };
  const handleChange5: NonNullable<React.ComponentProps<typeof TextField>["onChange"]> = (
    expected,
  ) => {
    if (value?.operator !== "equals") return;

    return onChange({
      ...value,
      expected:
        valueType === "artifact"
          ? { kind: "artifact", artifactId: expected }
          : { kind: "text", value: expected },
    });
  };

  return (
    <div className="space-y-3">
      <ChoiceField
        label="执行条件"
        options={[
          ...(optional ? [{ value: "always", label: "始终" }] : []),
          { value: "non_empty", label: "非空" },
          { value: "equals", label: "等于指定值" },
          { value: "contains", label: "包含文本", disabled: valueType !== "text" },
        ]}
        value={value?.operator ?? "always"}
        onChange={handleChange1}
      />
      {value && <ToggleField checked={value.negate} label="条件取反" onChange={handleChange2} />}
      {value?.operator === "contains" && (
        <TextField label="包含的文本" value={value.expected} onChange={handleChange3} />
      )}
      {value?.operator === "equals" &&
        (value.expected.kind === "json" ? (
          <JsonField label="比较 JSON 值" value={value.expected.value} onCommit={handleCommit4} />
        ) : (
          <TextField
            label={value.expected.kind === "artifact" ? "比较 Artifact ID" : "比较文本"}
            value={
              value.expected.kind === "artifact" ? value.expected.artifactId : value.expected.value
            }
            onChange={handleChange5}
          />
        ))}
    </div>
  );
};
