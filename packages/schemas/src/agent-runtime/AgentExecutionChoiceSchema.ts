import { z } from "zod/v4";

export const AgentRuntimePreferenceSchema = z.object({
  model: z.string().min(1).optional(),
  reasoningEffort: z.string().min(1).optional(),
  speed: z.string().min(1).optional(),
  firstOutputTimeoutSeconds: z.number().int().min(0).max(3600).optional(),
});
export type AgentRuntimePreference = z.infer<typeof AgentRuntimePreferenceSchema>;

export const AgentRuntimePreferencesSchema = z.record(
  z.string().min(1),
  AgentRuntimePreferenceSchema,
);
export type AgentRuntimePreferences = z.infer<typeof AgentRuntimePreferencesSchema>;

export const AgentExecutionChoiceSchema = AgentRuntimePreferenceSchema.extend({
  runtimeConfigId: z.string().min(1),
});
export type AgentExecutionChoice = z.infer<typeof AgentExecutionChoiceSchema>;
