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

export const TERMINAL_AGENT_RUN_STATUSES: ReadonlySet<AgentRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
