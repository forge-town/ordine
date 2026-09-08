import { TERMINAL_AGENT_RUN_STATUSES, type AgentRunStatus } from "@repo/schemas";

type ControlRunState = {
  controlMode: boolean;
  status: AgentRunStatus;
};

export const canAppendControlRunEvent = (run: ControlRunState | null): boolean =>
  Boolean(run?.controlMode && !TERMINAL_AGENT_RUN_STATUSES.has(run.status));
