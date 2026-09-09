import { Result, ok, err } from "neverthrow";
import { validatePortValues } from "@repo/pipeline-engine/execution-validation";
import {
  ExecutionPortDefinitionsSchema,
  ExecutionPortValuesSchema,
  type Operation,
  type ExecutionPortDefinition,
} from "@repo/schemas";

export const operationRunPorts = (operation: Operation) =>
  Result.fromThrowable(
    () => {
      const ports = operation.config.inputs.map((port) => {
        if (
          !port.id ||
          port.kind !== "prompt" ||
          port.accepts?.length !== 1 ||
          !["text/plain", "application/json"].includes(port.accepts[0]!)
        )
          throw new Error(
            `输入 ${port.name} 需要明确端口 ID 和 text/plain 或 application/json 类型；此面板暂不支持文件端口。`,
          );

        return {
          id: port.id,
          valueType: port.accepts[0] === "application/json" ? "json" : "text",
          cardinality: port.cardinality ?? "one",
          required: port.required,
          allowEmpty: false,
        };
      });

      return ExecutionPortDefinitionsSchema.parse(ports);
    },
    (error) => (error instanceof Error ? error : new Error("输入端口定义无效")),
  )();

/** many values use a JSON array; a one JSON value may itself be an array. */
export const parseOperationRunInputs = async (
  ports: ExecutionPortDefinition[],
  drafts: Record<string, string>,
) => {
  const parsed = Result.fromThrowable(
    () =>
      ExecutionPortValuesSchema.parse(
        Object.fromEntries(
          ports.flatMap((port) => {
            if (port.valueType === "artifact")
              throw new Error(`输入 ${port.id} 是文件端口，请先配置受支持的输入方式。`);
            const raw = drafts[port.id];
            if (raw === undefined || (!port.required && raw === "")) return [];
            const value =
              port.valueType === "json" || port.cardinality === "many"
                ? Result.fromThrowable(
                    () => JSON.parse(raw),
                    () => new Error(`输入 ${port.id} 的 JSON 格式无效。`),
                  )()
                : ok(raw);
            if (value.isErr()) throw value.error;
            if (port.cardinality === "many" && !Array.isArray(value.value))
              throw new Error(`输入 ${port.id} 需要 JSON 数组。`);
            const values: unknown[] = port.cardinality === "many" ? value.value : [value.value];

            return [[port.id, values.map((item) => ({ kind: port.valueType, value: item }))]];
          }),
        ),
      ),
    (error) => (error instanceof Error ? error : new Error("输入无效")),
  )();
  if (parsed.isErr()) throw parsed.error;
  const checked = await validatePortValues(ports, parsed.value, async () =>
    err({
      code: "ARTIFACT_UNSUPPORTED",
      message: "此面板暂不支持文件输入",
      retryable: false,
      stage: "artifact",
    }),
  );
  if (checked.isErr())
    throw new Error(`${checked.error.portId ?? "输入"}: ${checked.error.message}`);

  return checked.value;
};
