import type { AgentControlToolResult, AgentResourceRef } from "@repo/schemas";

import type { PersistedAction } from "../../contracts";

import { failureResult } from "../failureResult";
import { persistedArgumentDigest } from "../persistedArgumentDigest";

export const idempotencyMismatchResult = (
  action: PersistedAction,
  argumentDigest: string,
  resources: AgentResourceRef[],
): AgentControlToolResult | null =>
  persistedArgumentDigest(action) === argumentDigest
    ? null
    : failureResult({
        actionId: action.id,
        error: {
          code: "IDEMPOTENCY_ARGUMENT_MISMATCH",
          message: "callId was already used with different arguments; retry with a new callId.",
          retryable: false,
          field: "callId",
        },
        resources,
      });
