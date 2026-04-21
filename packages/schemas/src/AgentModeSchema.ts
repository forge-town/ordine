import { z } from "zod/v4";

export const AgentModeSchema = z.enum(["skill", "prompt"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;
