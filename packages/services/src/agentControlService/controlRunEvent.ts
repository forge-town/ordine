import type { AgentRunStatus } from "@repo/schemas";

const TERMINAL_AGENT_RUN_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);

type ControlRunState = {
  controlMode: boolean;
  status: AgentRunStatus;
};

export const canAppendControlRunEvent = (run: ControlRunState | null): boolean =>
  Boolean(run?.controlMode && !TERMINAL_AGENT_RUN_STATUSES.has(run.status));
