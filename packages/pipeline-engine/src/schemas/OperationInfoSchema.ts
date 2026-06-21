import { z } from "zod/v4";
import type { OperationConfigInput } from "@repo/schemas";

export const OperationInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  config: z.custom<OperationConfigInput>(),
});
export type OperationInfo = z.infer<typeof OperationInfoSchema>;
