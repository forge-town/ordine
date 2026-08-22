import { z } from "zod/v4";
import { DefaultAgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { AgentRuntimePreferencesSchema } from "../agent-runtime/AgentExecutionChoiceSchema";
import { MetaSchema } from "../meta";

export const SettingsSchema = z.object({
  id: z.string(),
  defaultAgentRuntime: DefaultAgentRuntimeSchema,
  defaultAgentRuntimeConfigId: z.string().min(1).nullable().optional(),
  agentRuntimePreferences: AgentRuntimePreferencesSchema.optional(),
  defaultApiKey: z.string(),
  defaultModel: z.string(),
  defaultOutputPath: z.string(),
  meta: MetaSchema.optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;
