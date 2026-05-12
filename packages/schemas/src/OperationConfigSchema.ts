import { z } from "zod/v4";
import { ExecutorConfigSchema } from "./ExecutorConfigSchema";
import { InputPortSchema } from "./InputPortSchema";
import { OutputItemSchema } from "./OutputItemSchema";

export const OperationConfigSchema = z.object({
  executor: ExecutorConfigSchema.optional(),
  inputs: z.array(InputPortSchema).default([]),
  outputs: z.array(OutputItemSchema).default([]),
});
export type OperationConfig = z.infer<typeof OperationConfigSchema>;
export type OperationConfigInput = z.input<typeof OperationConfigSchema>;
