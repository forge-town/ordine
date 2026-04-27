import { z } from "zod/v4";

export const AGENT_MODE_ENUM = {
  SKILL: "skill",
  PROMPT: "prompt",
} as const;

export const AgentModeSchema = z.enum(AGENT_MODE_ENUM);
export type AgentMode = z.infer<typeof AgentModeSchema>;
