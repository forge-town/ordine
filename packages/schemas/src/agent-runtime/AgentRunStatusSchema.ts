import { z } from "zod/v4";

export const AgentRunStatusSchema = z.enum(["completed", "error"]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
