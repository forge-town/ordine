import type { ExecutionJobState } from "@repo/schemas";
import type { JobStatusFilter } from "./_store";

export const jobStateFilter: Record<ExecutionJobState, Exclude<JobStatusFilter, "All">> = {
  queued: "Waiting",
  running: "Running",
  pausing: "Running",
  paused: "Running",
  waiting_for_input: "Waiting",
  cancelling: "Running",
  succeeded: "Completed",
  failed: "Failed",
  timed_out: "Failed",
  interrupted: "Failed",
  cancelled: "Cancelled",
};
export const jobActionsForState = (
  state: ExecutionJobState,
): ("pause" | "resume" | "cancel" | "rerun")[] => {
  if (state === "running") return ["pause", "cancel"];
  if (state === "paused") return ["resume", "cancel"];
  if (state === "queued" || state === "pausing" || state === "waiting_for_input") return ["cancel"];
  if (state === "cancelling") return [];

  return ["rerun"];
};
