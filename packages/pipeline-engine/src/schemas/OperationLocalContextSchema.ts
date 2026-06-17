import { z } from "zod/v4";

export const OperationLocalContextSchema = z.object({
  name: z.string(),
  description: z.string().default(""),
  instruction: z.string().optional(),
});
export type OperationLocalContext = z.infer<typeof OperationLocalContextSchema>;
