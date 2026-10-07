import type { AgentRunEventEnvelope } from "@repo/schemas";

import type { AgentRunsServiceBindings } from "../../contracts";
export const createBroadcastHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "listeners">) =>
  async (envelope: AgentRunEventEnvelope): Promise<void> => {
    const runListeners = serviceBindings.listeners.get(envelope.runId);
    if (!runListeners || runListeners.size === 0) return;
    await Promise.allSettled([...runListeners].map((listener) => listener(envelope)));
  };
