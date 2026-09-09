import { z } from "zod/v4";
import { ExecutionIdentifierSchema, ExecutionPortIdSchema } from "./ExecutionProtocolSchema";

export const ExecutionErrorSchema = z.strictObject({
  code: ExecutionIdentifierSchema,
  message: z.string().min(1).max(2000),
  retryable: z.boolean(),
  stage: z.enum([
    "authentication",
    "validation",
    "preparation",
    "approval",
    "execution",
    "artifact",
  ]),
  requestId: ExecutionIdentifierSchema.optional(),
  jobId: ExecutionIdentifierSchema.optional(),
  nodeId: ExecutionIdentifierSchema.optional(),
  portId: ExecutionPortIdSchema.optional(),
  field: z.string().max(200).optional(),
});
export type ExecutionError = z.infer<typeof ExecutionErrorSchema>;

export const ExecutionWarningsSchema = z.array(z.string().max(2000)).max(200);
export type ExecutionWarnings = z.infer<typeof ExecutionWarningsSchema>;
