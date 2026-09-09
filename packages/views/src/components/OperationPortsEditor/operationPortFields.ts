import { z } from "zod/v4";
import {
  ExecutionPortIdSchema,
  InputPortSchema,
  OutputItemSchema,
  type InputPort,
  type OutputItem,
  type OperationConfigInput,
} from "@repo/schemas";

const checkUniqueIds = (ports: { id?: string }[], context: z.RefinementCtx) => {
  const seen = new Set<string>();
  ports.forEach((port, index) => {
    if (port.id && seen.has(port.id))
      context.addIssue({ code: "custom", path: [index, "id"], message: "端口 ID 不能重复" });
    if (port.id) seen.add(port.id);
  });
};

export const EditableInputPortsSchema = z
  .array(
    InputPortSchema.extend({
      id: ExecutionPortIdSchema,
      cardinality: z.enum(["one", "many"]),
    }),
  )
  .superRefine(checkUniqueIds);
export const EditableOutputPortsSchema = z
  .array(
    OutputItemSchema.extend({
      id: ExecutionPortIdSchema,
      required: z.boolean(),
      cardinality: z.enum(["one", "many"]),
      templateIds: z.array(z.string()),
    }),
  )
  .superRefine(checkUniqueIds);
export const OperationPortFieldsSchema = z.object({
  inputs: EditableInputPortsSchema,
  outputs: EditableOutputPortsSchema,
});

/** Never assigns IDs to legacy ports or discards metadata while initializing a form. */
export const cloneOperationPorts = (config: OperationConfigInput) => ({
  inputs: structuredClone(config.inputs ?? []),
  outputs: structuredClone(config.outputs ?? []).map((port) => ({
    ...port,
    templateIds: port.templateIds ?? [],
  })),
});

export const nextOperationPortId = (
  ports: readonly { id?: string }[],
  direction: "input" | "output",
) => {
  const ids = new Set(ports.map((port) => port.id));
  const candidates = Array.from(
    { length: ports.length + 1 },
    (_, index) => `${direction}-${index + 1}`,
  );

  return candidates.find((id) => !ids.has(id))!;
};

export const createOperationInputPort = (ports: readonly InputPort[]): InputPort => ({
  id: nextOperationPortId(ports, "input"),
  name: "新输入",
  kind: "prompt",
  accepts: ["text/plain"],
  required: true,
  cardinality: "one",
});
export const createOperationOutputPort = (ports: readonly OutputItem[]): OutputItem => ({
  id: nextOperationPortId(ports, "output"),
  name: "新输出",
  contentType: "text",
  required: true,
  cardinality: "one",
  templateIds: [],
});

export const changeOperationInputType = (
  port: InputPort,
  valueType: "text" | "json",
): InputPort => ({
  ...port,
  kind: "prompt",
  accepts: [valueType === "json" ? "application/json" : "text/plain"],
});
