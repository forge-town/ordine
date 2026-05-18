import { z } from "zod/v4";
import { DefaultAgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { MetaSchema } from "../meta";

export const SettingsSchema = z.object({
  id: z.string(),
  defaultAgentRuntime: DefaultAgentRuntimeSchema,
  defaultApiKey: z.string(),
  defaultModel: z.string(),
  defaultOutputPath: z.string(),
  meta: MetaSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
