import { z } from "zod/v4";

import { AgentRuntimeSchema, OutputItemSchema } from "@repo/schemas";
import { OperationRuntimeContextSchema } from "./OperationRuntimeContextSchema";

export const RunSkillOptionsSchema = z.object({
  skillId: z.string(),
  skillDescription: z.string(),
  systemPrompt: z.string().optional(),
  inputContent: z.string(),
  inputPath: z.string(),
  runtimeContext: OperationRuntimeContextSchema.optional(),
  allowedTools: z.array(z.string()).optional(),
  agent: AgentRuntimeSchema.optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  reasoningEffort: z.string().optional(),
  speed: z.string().optional(),
  runtimeConfigId: z.string().optional(),
  executablePath: z.string().optional(),
  outputItems: z.array(OutputItemSchema).optional(),
  outputDir: z.string().optional(),
});
export type RunSkillOptions = z.infer<typeof RunSkillOptionsSchema> & {
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
};
