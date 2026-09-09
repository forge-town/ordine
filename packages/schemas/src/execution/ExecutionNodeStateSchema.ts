import { z } from "zod/v4";

export const ExecutionNodeStateSchema = z.enum([
  "queued",
  "running",
  "waiting_for_input",
  "succeeded",
  "failed",
  "skipped",
  "cancelled",
  "timed_out",
  "interrupted",
]);
export type ExecutionNodeState = z.infer<typeof ExecutionNodeStateSchema>;
