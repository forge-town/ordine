import { z } from "zod/v4";
import { ExecutionApiVersionSchema } from "./ExecutionProtocolSchema";
import { OperationRevisionSchema } from "./OperationRevisionSchema";

export const SaveOperationRevisionSchema = z
  .strictObject({
    apiVersion: ExecutionApiVersionSchema,
    expectedRevision: z.number().int().nonnegative(),
    operation: OperationRevisionSchema,
  })
  .superRefine((value, context) => {
    if (value.operation.revision !== value.expectedRevision + 1)
      context.addIssue({
        code: "custom",
        message: "Operation revision must advance exactly once",
        path: ["operation", "revision"],
      });
  });
export type SaveOperationRevision = z.infer<typeof SaveOperationRevisionSchema>;
