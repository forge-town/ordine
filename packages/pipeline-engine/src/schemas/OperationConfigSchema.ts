import { z } from "zod/v4";
import { ExecutorConfigSchema } from "./ExecutorConfigSchema.js";

export const OperationConfigSchema = z.object({
  executor: ExecutorConfigSchema.optional(),
});
export type OperationConfig = z.infer<typeof OperationConfigSchema>;
