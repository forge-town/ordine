import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { MetaSchema } from "./meta";

export const MAX_AGENT_ID_LENGTH = 64;
export const MAX_AGENT_NAME_LENGTH = 120;
export const MAX_AGENT_DESCRIPTION_LENGTH = 2_000;
export const MAX_AGENT_SYSTEM_PROMPT_LENGTH = 10_000;
export const MAX_AGENT_CAPABILITIES = 50;
export const MAX_AGENT_ALLOWED_TOOLS = 100;
export const MAX_AGENT_ALLOWED_SKILLS = 100;
export const MAX_AGENT_TAGS = 50;
export const MAX_AGENT_TAG_LENGTH = 64;
export const AgentIdSchema = z
  .string()
  .min(1)
  .max(MAX_AGENT_ID_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/);

const AgentTextSchema = z
  .string()
  .refine(
    (value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value),
    {
      message: "Text must not contain control characters",
    },
  );

export const AgentCapabilitySchema = z.object({
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH),
});
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentSchema = z.object({
  id: AgentIdSchema,
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH)
    .nullable()
    .default(null),
  defaultRuntime: AgentRuntimeSchema.nullable().default(null),
  systemPrompt: AgentTextSchema.max(MAX_AGENT_SYSTEM_PROMPT_LENGTH)
    .nullable()
    .default(null),
  capabilities: z
    .array(AgentCapabilitySchema)
    .max(MAX_AGENT_CAPABILITIES)
    .default([]),
  allowedTools: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_ALLOWED_TOOLS)
    .default([]),
  allowedSkillIds: z
    .array(AgentIdSchema)
    .max(MAX_AGENT_ALLOWED_SKILLS)
    .default([]),
  tags: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_TAGS)
    .default([]),
  meta: MetaSchema.optional(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentPatchSchema = z.object({
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH).optional(),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH)
    .nullable()
    .optional(),
  defaultRuntime: AgentRuntimeSchema.nullable().optional(),
  systemPrompt: AgentTextSchema.max(MAX_AGENT_SYSTEM_PROMPT_LENGTH)
    .nullable()
    .optional(),
  capabilities: z
    .array(AgentCapabilitySchema)
    .max(MAX_AGENT_CAPABILITIES)
    .optional(),
  allowedTools: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_ALLOWED_TOOLS)
    .optional(),
  allowedSkillIds: z
    .array(AgentIdSchema)
    .max(MAX_AGENT_ALLOWED_SKILLS)
    .optional(),
  tags: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_TAGS)
    .optional(),
  meta: MetaSchema.optional(),
});
export type AgentPatch = z.infer<typeof AgentPatchSchema>;

/** @deprecated Use AgentSchema instead */
export const AgentDefinitionSchema = AgentSchema;
/** @deprecated Use Agent instead */
export type AgentDefinition = Agent;
