import { z } from "zod/v4";

import { AgentBackendSchema } from "./ExecutorConfigSchema.js";

export const RunPromptOptionsSchema = z.object({
  prompt: z.string(),
  inputContent: z.string(),
  inputPath: z.string(),
  modelOverride: z.string().optional(),
  agent: AgentBackendSchema.optional(),
});
export type RunPromptOptions = z.infer<typeof RunPromptOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
