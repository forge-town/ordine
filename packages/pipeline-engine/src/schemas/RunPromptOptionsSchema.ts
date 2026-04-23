import { z } from "zod/v4";

import { AgentRuntimeSchema } from "@repo/schemas";

export const RunPromptOptionsSchema = z.object({
  prompt: z.string(),
  inputContent: z.string(),
  inputPath: z.string(),
  jobId: z.string().optional(),
  agent: AgentRuntimeSchema.optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});
export type RunPromptOptions = z.infer<typeof RunPromptOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
