import { z } from "zod/v4";

export const AgentRunStatusSchema = z.enum([
  "queued",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type AgentRunStatus = z.infer<typeof AgentRunStatusSchema>;
