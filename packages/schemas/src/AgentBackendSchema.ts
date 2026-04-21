import { z } from "zod/v4";

export const AgentBackendSchema = z.enum(["local-claude", "codex"]);
export type AgentBackend = z.infer<typeof AgentBackendSchema>;
