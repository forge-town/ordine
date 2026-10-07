import type { AgentRuntime } from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createResolveAttachmentRuntimeHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "resolveEffectiveRuntime">) =>
  (input: {
    requestedRuntimeId?: string;
    runtimes: Array<{ id: string; type: AgentRuntime } & Record<string, unknown>>;
    defaultRuntime?: string | null;
  }): AgentRuntime | null =>
    (0, serviceBindings.resolveEffectiveRuntime)(input);
