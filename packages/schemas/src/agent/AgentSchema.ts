import { z } from "zod/v4";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { MetaSchema } from "../meta";
import {
  MAX_AGENT_ALLOWED_SKILLS,
  MAX_AGENT_ALLOWED_TOOLS,
  MAX_AGENT_CAPABILITIES,
  MAX_AGENT_DESCRIPTION_LENGTH,
  MAX_AGENT_NAME_LENGTH,
  MAX_AGENT_SYSTEM_PROMPT_LENGTH,
  MAX_AGENT_TAGS,
  MAX_AGENT_TAG_LENGTH,
} from "./AgentConstraints";
import { AgentCapabilitySchema } from "./AgentCapabilitySchema";
import { AgentIdSchema } from "./AgentIdSchema";
import { AgentTextSchema } from "./AgentTextSchema";

export const AgentSchema = z.object({
  id: AgentIdSchema,
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH).nullable().default(null),
  defaultRuntime: AgentRuntimeSchema.nullable().default(null),
  systemPrompt: AgentTextSchema.max(MAX_AGENT_SYSTEM_PROMPT_LENGTH).nullable().default(null),
  capabilities: z.array(AgentCapabilitySchema).max(MAX_AGENT_CAPABILITIES).default([]),
  allowedTools: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_ALLOWED_TOOLS)
    .default([]),
  allowedSkillIds: z.array(AgentIdSchema).max(MAX_AGENT_ALLOWED_SKILLS).default([]),
  tags: z.array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH)).max(MAX_AGENT_TAGS).default([]),
  meta: MetaSchema.optional(),
});
export type Agent = z.infer<typeof AgentSchema>;
