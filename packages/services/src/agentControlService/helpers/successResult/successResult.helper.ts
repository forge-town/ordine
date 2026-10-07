import { redactAgentControlResult } from "@repo/agent-control";

import { AgentControlToolResultSchema, type AgentControlToolResult } from "@repo/schemas";

import type { DomainValue } from "../../contracts";

export const successResult = (actionId: string, value: DomainValue): AgentControlToolResult =>
  AgentControlToolResultSchema.parse({
    actionId,
    status: "succeeded",
    resources: value.resources,
    summary: value.summary,
    warnings: value.warnings ?? [],
    ...(value.data ? { data: redactAgentControlResult(value.data) } : {}),
  });
