import type { EventListener, AgentRunsServiceBindings } from "../../contracts";

export const createSubscribeMethod = (
  serviceBindings: Pick<AgentRunsServiceBindings, "listeners">,
) =>
  ({
    subscribe(runId: string, listener: EventListener): () => void {
      const runListeners = serviceBindings.listeners.get(runId) ?? new Set<EventListener>();
      runListeners.add(listener);
      serviceBindings.listeners.set(runId, runListeners);

      return () => {
        runListeners.delete(listener);
        if (runListeners.size === 0) serviceBindings.listeners.delete(runId);
      };
    },
  }).subscribe;
