import { z } from "zod/v4";

import { AgentRuntimeSchema } from "@repo/schemas";

export const RunSkillOptionsSchema = z.object({
  skillId: z.string(),
  skillDescription: z.string(),
  inputContent: z.string(),
  inputPath: z.string(),
  writeEnabled: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  promptMode: z.enum(["code", "research"]).optional(),
  agent: AgentRuntimeSchema.optional(),
});
export type RunSkillOptions = z.infer<typeof RunSkillOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
