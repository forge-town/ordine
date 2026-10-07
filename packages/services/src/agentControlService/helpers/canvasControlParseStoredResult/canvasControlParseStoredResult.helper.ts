import {
  AgentControlToolResultSchema,
  type AgentActionStatus,
  type AgentControlToolResult,
} from "@repo/schemas";

export const parseStoredResult = (
  actionId: string,
  status: AgentActionStatus,
  value: Record<string, unknown> | null,
): AgentControlToolResult => {
  const parsed = AgentControlToolResultSchema.safeParse(value);
  if (parsed.success) {
    return status === "succeeded"
      ? AgentControlToolResultSchema.parse({ ...parsed.data, status: "replayed" })
      : parsed.data;
  }

  return AgentControlToolResultSchema.parse({
    actionId,
    status: "failed",
    resources: [],
    summary: "The matching tool call is still incomplete; retry after the current run settles.",
    warnings: [],
    retry: {
      retryable: true,
      code: "ACTION_IN_PROGRESS",
      message: "The matching idempotency key already has an incomplete action.",
    },
  });
};
