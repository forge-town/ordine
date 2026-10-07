import {
  AgentControlToolResultSchema,
  type AgentControlToolResult,
  type AgentResourceRef,
} from "@repo/schemas";

import type { DomainError } from "../../contracts";

export const failureResult = ({
  actionId,
  error,
  resources = [],
}: {
  actionId: string;
  error: DomainError;
  resources?: AgentResourceRef[];
}): AgentControlToolResult =>
  AgentControlToolResultSchema.parse({
    actionId,
    status: "failed",
    resources,
    summary: error.message,
    warnings: [],
    retry: {
      retryable: error.retryable,
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
      ...(error.nodeId ? { nodeId: error.nodeId } : {}),
      ...(error.portId ? { portId: error.portId } : {}),
    },
  });
