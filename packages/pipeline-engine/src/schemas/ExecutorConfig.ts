import { z } from "zod/v4";

export const ExecutorConfigSchema = z.object({
  type: z.string(),
  agentMode: z.enum(["skill", "prompt"]).optional(),
  skillId: z.string().optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
  language: z.enum(["bash", "python", "javascript"]).optional(),
  writeEnabled: z.boolean().optional(),
});
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;
