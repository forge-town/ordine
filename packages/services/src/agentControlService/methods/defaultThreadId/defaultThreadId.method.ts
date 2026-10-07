import type { AgentControlInvocationContext } from "@repo/agent-control";

import type { AgentControlServiceBindings } from "../../contracts";
export const createDefaultThreadIdMethod = (
  _serviceBindings: Pick<AgentControlServiceBindings, never>,
) =>
  ({
    defaultThreadId(audience: AgentControlInvocationContext["audience"]): string {
      return `agent-control-${audience}-local-owner`;
    },
  }).defaultThreadId;
