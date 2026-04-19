import { z } from "zod/v4";

export const ClaudeMessageUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
});

export type ClaudeMessageUsage = z.infer<typeof ClaudeMessageUsageSchema>;
