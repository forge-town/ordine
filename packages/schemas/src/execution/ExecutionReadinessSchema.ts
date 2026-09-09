import { z } from "zod/v4";
import { ExecutionApiVersionSchema, ExecutionIdentifierSchema } from "./ExecutionProtocolSchema";

export const ExecutionReadinessSchema = z
  .strictObject({
    ordineApiVersion: ExecutionApiVersionSchema,
    graphSchemaVersion: ExecutionApiVersionSchema,
    buildRevision: z.string().min(1).max(160),
    instanceId: z.uuid(),
    workspaceId: ExecutionIdentifierSchema,
    mode: z.enum(["desktop", "service"]),
    status: z.enum(["ready", "not_ready"]),
    database: z.strictObject({
      reachable: z.boolean(),
      schemaVersion: z.number().int().positive().nullable(),
    }),
    capabilities: z.strictObject({
      valueTypes: z.array(z.enum(["text", "json", "artifact"])).max(3),
      localAgentRuntimeIds: z.array(ExecutionIdentifierSchema).max(64),
    }),
    limits: z.strictObject({
      maxNodes: z.number().int().positive(),
      maxEdges: z.number().int().positive(),
      maxRequestBytes: z.number().int().positive(),
      maxInlineValueBytes: z.number().int().positive(),
    }),
  })
  .superRefine((value, context) => {
    if (
      (value.status === "ready") !==
      (value.database.reachable && value.database.schemaVersion === 2)
    )
      context.addIssue({
        code: "custom",
        message: "Readiness must reflect the required database schema",
        path: ["status"],
      });
  });
export type ExecutionReadiness = z.infer<typeof ExecutionReadinessSchema>;
