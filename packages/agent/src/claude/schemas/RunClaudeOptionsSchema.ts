import { z } from "zod/v4";
import { ToolNameSchema } from "./ToolNameSchema";

export const RunClaudeOptionsSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  cwd: z.string(),
  allowedTools: z.array(ToolNameSchema).readonly().optional(),
  timeoutMs: z.number().optional(),
  maxBudgetUsd: z.number().optional(),
  onProgress: z.custom<(line: string) => Promise<void>>().optional(),
});

export type RunClaudeOptions = z.infer<typeof RunClaudeOptionsSchema>;
