import { z } from "zod/v4";

import { AgentRuntimeSchema } from "@repo/schemas";

export const RunSkillOptionsSchema = z.object({
  skillId: z.string(),
  skillDescription: z.string(),
  systemPrompt: z.string().optional(),
  inputContent: z.string(),
  inputPath: z.string(),
  allowedTools: z.array(z.string()).optional(),
  agent: AgentRuntimeSchema.optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});
export type RunSkillOptions = z.infer<typeof RunSkillOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
