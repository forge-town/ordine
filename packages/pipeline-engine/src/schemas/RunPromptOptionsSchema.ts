import { z } from "zod/v4";

export const RunPromptOptionsSchema = z.object({
  prompt: z.string(),
  inputContent: z.string(),
  modelOverride: z.string().optional(),
});
export type RunPromptOptions = z.infer<typeof RunPromptOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
