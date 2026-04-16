import { z } from "zod/v4";

export const RunSkillOptionsSchema = z.object({
  skillId: z.string(),
  skillDescription: z.string(),
  inputContent: z.string(),
  inputPath: z.string(),
  modelOverride: z.string().optional(),
  writeEnabled: z.boolean().optional(),
});
export type RunSkillOptions = z.infer<typeof RunSkillOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
