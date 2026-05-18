import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";

export const DistillationConfigSchema = z.object({
  objective: z.string().default(""),
  systemPrompt: z.string().optional(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string().optional(),
});
export type DistillationConfig = z.infer<typeof DistillationConfigSchema>;
