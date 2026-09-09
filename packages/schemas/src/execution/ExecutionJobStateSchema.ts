import { z } from "zod/v4";

export const ExecutionJobStateSchema = z.enum([
  "queued",
  "running",
  "pausing",
  "paused",
  "waiting_for_input",
  "cancelling",
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type ExecutionJobState = z.infer<typeof ExecutionJobStateSchema>;

export const ExecutionTerminalJobStateSchema = z.enum([
  "succeeded",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type ExecutionTerminalJobState = z.infer<typeof ExecutionTerminalJobStateSchema>;
