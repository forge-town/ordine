import { AgentControlToolResultSchema, type AgentControlToolResult } from "@repo/schemas";

import type { PersistedAction } from "../../contracts";

import { failureResult } from "../failureResult";

export const replayResult = (action: PersistedAction): AgentControlToolResult => {
  const parsed = AgentControlToolResultSchema.safeParse(action.result);
  if (!parsed.success) {
    return failureResult({
      actionId: action.id,
      error: {
        code: "ACTION_IN_PROGRESS",
        message: "The matching callId is still incomplete; retry after the current call settles.",
        retryable: true,
      },
    });
  }

  return action.status === "succeeded"
    ? AgentControlToolResultSchema.parse({ ...parsed.data, status: "replayed" })
    : parsed.data;
};
