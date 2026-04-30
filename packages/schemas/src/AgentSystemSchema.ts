import { z } from "zod/v4";

export const AgentSystemSchema = z.enum(["claude-code", "codex", "mastra", "openclaw", "custom"]);
export type AgentSystem = z.infer<typeof AgentSystemSchema>;

export const AgentRunStatusSchema = z.enum(["completed", "error"]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
