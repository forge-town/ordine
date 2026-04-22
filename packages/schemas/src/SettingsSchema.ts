import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";

export const SettingsSchema = z.object({
  id: z.string(),
  defaultAgentRuntime: AgentRuntimeSchema,
  defaultApiKey: z.string(),
  defaultModel: z.string(),
  defaultOutputPath: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Settings = z.infer<typeof SettingsSchema>;
