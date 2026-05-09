import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { MetaSchema } from "./meta";

export const AgentCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
});
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  defaultRuntime: AgentRuntimeSchema.nullable().default(null),
  systemPrompt: z.string().nullable().default(null),
  capabilities: z.array(AgentCapabilitySchema).default([]),
  allowedTools: z.array(z.string()).default([]),
  allowedSkillIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  meta: MetaSchema.optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

/** @deprecated Use AgentSchema instead */
export const AgentDefinitionSchema = AgentSchema;
/** @deprecated Use Agent instead */
export type AgentDefinition = Agent;
