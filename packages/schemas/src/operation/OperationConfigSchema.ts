import { z } from "zod/v4";
import { OperationExecutorConfigSchema } from "./OperationExecutorConfigSchema";
import { InputPortSchema } from "./InputPortSchema";
import { OutputItemSchema } from "./OutputItemSchema";

export const OperationConfigSchema = z.object({
  executor: OperationExecutorConfigSchema.optional(),
  inputs: z.array(InputPortSchema).default([]),
  outputs: z.array(OutputItemSchema).default([]),
});
export type OperationConfig = z.infer<typeof OperationConfigSchema>;
export type OperationConfigInput = z.input<typeof OperationConfigSchema>;
