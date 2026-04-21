import { z } from "zod/v4";

export const AgentRuntimeSchema = z.enum(["claude-code", "codex"]);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;
