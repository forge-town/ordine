import { z } from "zod/v4";
import { ToolNameSchema } from "./ToolNameSchema";

export const SshConnectionOptionsSchema = z.object({
  host: z.string(),
  user: z.string(),
  port: z.number().int().positive().optional(),
  keyPath: z.string().optional(),
});

export type SshConnectionOptions = z.infer<typeof SshConnectionOptionsSchema>;

export const RunClaudeOptionsSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  cwd: z.string(),
  allowedTools: z.array(ToolNameSchema).readonly().optional(),
  timeoutMs: z.number().optional(),
  maxBudgetUsd: z.number().optional(),
  onProgress: z.custom<(line: string) => Promise<void>>().optional(),
  extraEnv: z.record(z.string(), z.string()).optional(),
  ssh: SshConnectionOptionsSchema.optional(),
});

export type RunClaudeOptions = z.infer<typeof RunClaudeOptionsSchema>;
