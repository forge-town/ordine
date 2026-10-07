import { type AgentRuntime, parseLocalAgentRuntimeId } from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createResolveEffectiveRuntimeHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) =>
  (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }): AgentRuntime | null => {
    if (input.requestedRuntimeId) {
      const requested = input.runtimes.find((runtime) => runtime.id === input.requestedRuntimeId);

      return requested?.type ?? parseLocalAgentRuntimeId(input.requestedRuntimeId);
    }

    const defaultRuntime =
      input.defaultRuntime &&
      input.runtimes.find((runtime) => runtime.type === input.defaultRuntime);
    if (defaultRuntime) {
      return defaultRuntime.type;
    }

    return input.runtimes[0]?.type ?? null;
  };
