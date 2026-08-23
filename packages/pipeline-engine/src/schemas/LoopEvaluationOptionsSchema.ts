import { z } from "zod/v4";

import { AgentRuntimeSchema } from "@repo/schemas";

export const LoopEvaluationOptionsSchema = z.object({
  conditionPrompt: z.string(),
  operationOutput: z.string(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string().optional(),
  reasoningEffort: z.string().optional(),
  speed: z.string().optional(),
  runtimeConfigId: z.string().optional(),
  executablePath: z.string().optional(),
});
export type LoopEvaluationOptions = z.infer<typeof LoopEvaluationOptionsSchema>;
