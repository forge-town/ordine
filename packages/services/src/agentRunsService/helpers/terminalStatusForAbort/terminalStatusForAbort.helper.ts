import type { AbortReason, TerminalAgentRunStatus } from "../../contracts";

export const terminalStatusForAbort = (reason: AbortReason | null): TerminalAgentRunStatus =>
  reason === "first_output_timeout" || reason === "inactivity_timeout" ? "timed_out" : "cancelled";
