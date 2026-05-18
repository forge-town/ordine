import { z } from "zod/v4";
import {
  MAX_AGENT_DESCRIPTION_LENGTH,
  MAX_AGENT_NAME_LENGTH,
} from "./AgentConstraints";
import { AgentTextSchema } from "./AgentTextSchema";

export const AgentCapabilitySchema = z.object({
  name: AgentTextSchema.min(1).max(MAX_AGENT_NAME_LENGTH),
  description: AgentTextSchema.max(MAX_AGENT_DESCRIPTION_LENGTH),
});
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;
