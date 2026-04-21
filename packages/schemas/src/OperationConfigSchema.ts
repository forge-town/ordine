import { z } from "zod/v4";
import { ExecutorConfigSchema } from "./ExecutorConfigSchema";
import { InputPortSchema } from "./InputPortSchema";
import { OutputPortSchema } from "./OutputPortSchema";

export const OperationConfigSchema = z.object({
  executor: ExecutorConfigSchema.optional(),
  inputs: z.array(InputPortSchema).default([]),
  outputs: z.array(OutputPortSchema).default([]),
});
export type OperationConfig = z.infer<typeof OperationConfigSchema>;
export type OperationConfigInput = z.input<typeof OperationConfigSchema>;
