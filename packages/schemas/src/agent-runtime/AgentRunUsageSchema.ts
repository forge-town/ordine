import { z } from "zod/v4";

export const AgentRunUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cachedInputTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative().optional(),
});
export type AgentRunUsage = z.infer<typeof AgentRunUsageSchema>;
