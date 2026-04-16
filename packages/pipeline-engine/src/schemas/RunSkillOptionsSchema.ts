import { z } from "zod/v4";

import { AgentBackendSchema } from "./ExecutorConfigSchema.js";

export const RunSkillOptionsSchema = z.object({
  skillId: z.string(),
  skillDescription: z.string(),
  inputContent: z.string(),
  inputPath: z.string(),
  modelOverride: z.string().optional(),
  writeEnabled: z.boolean().optional(),
  agent: AgentBackendSchema.optional(),
});
export type RunSkillOptions = z.infer<typeof RunSkillOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
