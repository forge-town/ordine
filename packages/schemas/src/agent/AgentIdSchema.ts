import { z } from "zod/v4";
import { MAX_AGENT_ID_LENGTH } from "./AgentConstraints";

export const AgentIdSchema = z
  .string()
  .min(1)
  .max(MAX_AGENT_ID_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/);
export type AgentId = z.infer<typeof AgentIdSchema>;
