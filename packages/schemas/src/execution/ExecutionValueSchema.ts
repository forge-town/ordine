import { z } from "zod/v4";
import {
  EXECUTION_INLINE_VALUE_MAX_BYTES,
  EXECUTION_MAX_JSON_DEPTH,
  EXECUTION_MAX_JSON_NODES,
  EXECUTION_MAX_PORTS,
  EXECUTION_MAX_VALUES_PER_PORT,
  ExecutionIdentifierSchema,
  ExecutionPortIdSchema,
} from "./ExecutionProtocolSchema";

const inlineBytesWithinLimit = (value: string) =>
  new TextEncoder().encode(value).byteLength <= EXECUTION_INLINE_VALUE_MAX_BYTES;

const BoundedJsonSchema = z.preprocess((value, context) => {
  const pending = [{ value, depth: 0 }];
  const state = { visited: 0 };
  while (pending.length > 0) {
    const entry = pending.pop()!;
    state.visited += 1;
    if (entry.depth > EXECUTION_MAX_JSON_DEPTH || state.visited > EXECUTION_MAX_JSON_NODES) {
      context.addIssue({ code: "custom", message: "JSON nesting or item limit exceeded" });

      return z.NEVER;
    }
    if (entry.value && typeof entry.value === "object") {
      const prototype = Object.getPrototypeOf(entry.value);
      if (!Array.isArray(entry.value) && prototype !== Object.prototype && prototype !== null) {
        context.addIssue({ code: "custom", message: "JSON values must contain only plain data" });

        return z.NEVER;
      }
      if (Object.hasOwn(entry.value, "__proto__")) {
        context.addIssue({ code: "custom", message: "Reserved JSON key __proto__" });

        return z.NEVER;
      }
      const children = Object.values(entry.value);
      if (pending.length + children.length + state.visited > EXECUTION_MAX_JSON_NODES) {
        context.addIssue({ code: "custom", message: "JSON item limit exceeded" });

        return z.NEVER;
      }
      for (const child of children) pending.push({ value: child, depth: entry.depth + 1 });
    }
  }

  return value;
}, z.json());

export const ExecutionTextValueSchema = z.strictObject({
  kind: z.literal("text"),
  value: z
    .string()
    .max(EXECUTION_INLINE_VALUE_MAX_BYTES)
    .refine(inlineBytesWithinLimit, "Inline text exceeds the UTF-8 byte limit"),
});
export const ExecutionJsonValueSchema = z.strictObject({
  kind: z.literal("json"),
  value: BoundedJsonSchema.refine(
    (value) => inlineBytesWithinLimit(JSON.stringify(value)),
    "Inline JSON exceeds byte limit",
  ),
});
export const ExecutionArtifactValueSchema = z.strictObject({
  kind: z.literal("artifact"),
  artifactId: ExecutionIdentifierSchema,
});
export const ExecutionValueSchema = z.discriminatedUnion("kind", [
  ExecutionTextValueSchema,
  ExecutionJsonValueSchema,
  ExecutionArtifactValueSchema,
]);
export type ExecutionValue = z.infer<typeof ExecutionValueSchema>;

export const ExecutionPortValuesSchema = z.preprocess(
  (value, context) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length > EXECUTION_MAX_PORTS) {
        context.addIssue({ code: "custom", message: "Too many input ports" });
      }
      // Records intentionally omit __proto__; reject it before that omission can hide invalid input.
      for (const key of keys) {
        if (!ExecutionPortIdSchema.safeParse(key).success) {
          context.addIssue({
            code: "custom",
            message: "Invalid input port identifier",
            path: [key],
          });
        }
      }
    }

    return value;
  },
  z.record(ExecutionPortIdSchema, z.array(ExecutionValueSchema).max(EXECUTION_MAX_VALUES_PER_PORT)),
);
export type ExecutionPortValues = z.infer<typeof ExecutionPortValuesSchema>;
