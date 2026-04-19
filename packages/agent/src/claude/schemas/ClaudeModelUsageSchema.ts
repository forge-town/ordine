import { z } from "zod/v4";

export const ClaudeModelUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  costUSD: z.number().optional(),
});

export type ClaudeModelUsage = z.infer<typeof ClaudeModelUsageSchema>;
