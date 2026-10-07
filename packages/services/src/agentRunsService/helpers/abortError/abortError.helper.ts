import type { AbortReason } from "../../contracts";

import { formatTimeout } from "../formatTimeout";

export const abortError = (
  reason: AbortReason,
  firstOutputTimeoutMs: number,
  inactivityTimeoutMs: number,
): { code: string; message: string } => {
  if (reason === "first_output_timeout") {
    return {
      code: "AGENT_FIRST_OUTPUT_TIMEOUT",
      message: `Agent produced no model output within ${formatTimeout(firstOutputTimeoutMs)}`,
    };
  }
  if (reason === "inactivity_timeout") {
    return {
      code: "AGENT_INACTIVITY_TIMEOUT",
      message: `Agent produced no activity for ${formatTimeout(inactivityTimeoutMs)}`,
    };
  }

  return { code: "AGENT_RUN_CANCELLED", message: "Agent run was cancelled" };
};
