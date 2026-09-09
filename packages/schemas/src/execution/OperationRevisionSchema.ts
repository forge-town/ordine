import { z } from "zod/v4";
import { NodeExecutionOverridesSchema } from "./ExecutionOptionsSchema";
import {
  ExecutionJsonObjectSchema,
  ExecutionPortDefinitionsSchema,
} from "./ExecutionPortDefinitionSchema";
import {
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionRevisionSchema,
} from "./ExecutionProtocolSchema";

const BoundedOperationTextSchema = z
  .string()
  .max(65_536)
  .refine(
    (value) => new TextEncoder().encode(value).byteLength <= 65_536,
    "Operation text exceeds the 64 KiB UTF-8 byte limit",
  );
const NonBlankOperationTextSchema = BoundedOperationTextSchema.min(1).refine(
  (value) => value.trim().length > 0,
  "Executable content must not be blank",
);
const CapabilityReferencesSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(256)
      .refine((value) => value.trim().length > 0, "Capability references must not be blank"),
  )
  .max(64)
  .superRefine((values, context) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value))
        context.addIssue({
          code: "custom",
          message: "Duplicate capability reference",
          path: [index],
        });
      seen.add(value);
    });
  })
  .meta({ uniqueItems: true });

export const OperationExecutorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("script"),
    language: z.enum(["javascript", "python", "bash"]),
    source: NonBlankOperationTextSchema,
    outputMode: z.enum(["text", "json", "manifest"]),
  }),
  z.strictObject({
    kind: z.literal("agent"),
    instruction: NonBlankOperationTextSchema,
    systemPrompt: BoundedOperationTextSchema.optional(),
    skillId: ExecutionIdentifierSchema.optional(),
    allowedTools: CapabilityReferencesSchema.default([]),
  }),
  z.strictObject({
    kind: z.literal("builtin"),
    name: z.enum(["identity", "merge_text", "write_artifact", "read_artifact", "materialize_file"]),
    config: ExecutionJsonObjectSchema.default({}),
  }),
]);
export type OperationExecutor = z.infer<typeof OperationExecutorSchema>;

export const OperationRevisionSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  id: ExecutionIdentifierSchema,
  revision: ExecutionRevisionSchema,
  name: z.string().min(1).max(240),
  description: BoundedOperationTextSchema.default(""),
  inputPorts: ExecutionPortDefinitionsSchema,
  outputPorts: ExecutionPortDefinitionsSchema,
  executor: OperationExecutorSchema,
  executionDefaults: NodeExecutionOverridesSchema.default({}),
  capabilityRefs: CapabilityReferencesSchema.default([]),
});
export type OperationRevision = z.infer<typeof OperationRevisionSchema>;
