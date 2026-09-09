import { Result } from "neverthrow";
import { ExecutionPortValuesSchema, type ExecutionPortDefinition } from "@repo/schemas";
import {
  validatePortValues,
  type ArtifactMetadataLookup,
} from "@repo/pipeline-engine/execution-validation";

/** Raw fields are parsed once at submission, so uncommitted JSON never silently uses an older value. */
export const parsePublishedPipelineInputs = async (
  ports: ExecutionPortDefinition[],
  drafts: Record<string, string>,
  lookup: ArtifactMetadataLookup,
) => {
  const parsed = Result.fromThrowable(
    () => {
      const ids = new Set(ports.map((port) => port.id));
      if (Object.keys(drafts).some((id) => !ids.has(id))) throw new Error("输入包含未声明的端口。");

      return ExecutionPortValuesSchema.parse(
        Object.fromEntries(
          ports.flatMap((port) => {
            const raw = drafts[port.id];
            if (raw === undefined) return [];
            const value =
              port.valueType === "json" || port.cardinality === "many"
                ? Result.fromThrowable(
                    (): unknown => JSON.parse(raw),
                    () => new Error(`输入 ${port.id} 的 JSON 格式错误。`),
                  )()
                : Result.fromThrowable(
                    () => raw,
                    () => new Error("输入无效。"),
                  )();
            if (value.isErr()) throw value.error;
            if (port.cardinality === "many" && !Array.isArray(value.value))
              throw new Error(`输入 ${port.id} 需要 JSON 数组。`);
            const values: unknown[] =
              port.cardinality === "many" ? (value.value as unknown[]) : [value.value];

            return [
              [
                port.id,
                values.map((item) =>
                  port.valueType === "artifact"
                    ? { kind: "artifact", artifactId: item }
                    : { kind: port.valueType, value: item },
                ),
              ],
            ];
          }),
        ),
      );
    },
    (error) => (error instanceof Error ? error : new Error("输入不符合已发布契约。")),
  )();
  if (parsed.isErr()) throw parsed.error;
  const checked = await validatePortValues(ports, parsed.value, lookup);
  if (checked.isErr())
    throw new Error(`${checked.error.portId ?? "输入"}: ${checked.error.message}`);

  return checked.value;
};
