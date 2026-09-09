import { z } from "zod/v4";
import { EXECUTION_MAX_PORTS, ExecutionPortIdSchema } from "./ExecutionProtocolSchema";
import { ExecutionJsonValueSchema } from "./ExecutionValueSchema";

// Reuse bounded JSON validation before recursively accepting an object payload.
export const ExecutionJsonObjectSchema = ExecutionJsonValueSchema.shape.value.pipe(
  z.record(z.string(), z.json()),
);
export type ExecutionJsonObject = z.infer<typeof ExecutionJsonObjectSchema>;

export const ExecutionPortDefinitionSchema = z
  .strictObject({
    id: ExecutionPortIdSchema,
    valueType: z.enum(["text", "json", "artifact"]),
    cardinality: z.enum(["one", "many"]),
    required: z
      .boolean()
      .default(true)
      .describe("Whether this port must be supplied rather than omitted"),
    // required governs absence; allowEmpty governs explicit empty values at runtime.
    allowEmpty: z
      .boolean()
      .default(false)
      .describe(
        "Whether explicit empty text, empty JSON, or zero-byte artifacts are allowed; actual values and files are checked at runtime",
      ),
    mimeTypes: z
      .array(
        z
          .string()
          .min(1)
          .max(128)
          .refine((value) => value.trim().length > 0, "MIME types must not be blank"),
      )
      .max(32)
      .superRefine((values, context) => {
        const seen = new Set<string>();
        values.forEach((value, index) => {
          if (seen.has(value))
            context.addIssue({ code: "custom", message: "Duplicate MIME type", path: [index] });
          seen.add(value);
        });
      })
      .meta({ uniqueItems: true })
      .optional(),
    jsonSchema: ExecutionJsonObjectSchema.optional(),
  })
  .superRefine((port, context) => {
    if (port.mimeTypes !== undefined && port.valueType !== "artifact") {
      context.addIssue({
        code: "custom",
        message: "MIME types apply only to artifact ports",
        path: ["mimeTypes"],
      });
    }
    if (port.jsonSchema !== undefined && port.valueType !== "json") {
      context.addIssue({
        code: "custom",
        message: "JSON Schema applies only to JSON ports",
        path: ["jsonSchema"],
      });
    }
  });
export type ExecutionPortDefinition = z.infer<typeof ExecutionPortDefinitionSchema>;

export const ExecutionPortDefinitionsSchema = z
  .array(ExecutionPortDefinitionSchema)
  .max(EXECUTION_MAX_PORTS)
  .superRefine((ports, context) => {
    const seen = new Set<string>();
    ports.forEach((port, index) => {
      if (seen.has(port.id)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate port identifier",
          path: [index, "id"],
        });
      }
      seen.add(port.id);
    });
  });
export type ExecutionPortDefinitions = z.infer<typeof ExecutionPortDefinitionsSchema>;
