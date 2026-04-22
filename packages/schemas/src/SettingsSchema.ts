import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { MetaSchema } from "./meta";

export const SettingsSchema = z.object({
  id: z.string(),
  defaultAgentRuntime: AgentRuntimeSchema,
  defaultApiKey: z.string(),
  defaultModel: z.string(),
  defaultOutputPath: z.string(),
  meta: MetaSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
