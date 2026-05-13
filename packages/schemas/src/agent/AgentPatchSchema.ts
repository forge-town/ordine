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

export const AgentPatchSchema = z.object({
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH).optional(),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH).nullable().optional(),
  defaultRuntime: AgentRuntimeSchema.nullable().optional(),
  systemPrompt: AgentTextSchema.max(MAX_AGENT_SYSTEM_PROMPT_LENGTH).nullable().optional(),
  capabilities: z.array(AgentCapabilitySchema).max(MAX_AGENT_CAPABILITIES).optional(),
  allowedTools: z
    .array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH))
    .max(MAX_AGENT_ALLOWED_TOOLS)
    .optional(),
  allowedSkillIds: z.array(AgentIdSchema).max(MAX_AGENT_ALLOWED_SKILLS).optional(),
  tags: z.array(AgentTextSchema.min(1).max(MAX_AGENT_TAG_LENGTH)).max(MAX_AGENT_TAGS).optional(),
  meta: MetaSchema.optional(),
});
export type AgentPatch = z.infer<typeof AgentPatchSchema>;
