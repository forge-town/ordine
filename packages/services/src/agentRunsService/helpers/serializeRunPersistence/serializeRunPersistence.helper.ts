import type { AgentRunsServiceBindings } from "../../contracts";
export const createSerializeRunPersistenceHelper =
  (serviceBindings: Pick<AgentRunsServiceBindings, "eventPersistenceQueues">) =>
  <T>(runId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = serviceBindings.eventPersistenceQueues.get(runId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const marker = current.then(
      () => {
        if (serviceBindings.eventPersistenceQueues.get(runId) === marker)
          serviceBindings.eventPersistenceQueues.delete(runId);
      },
      () => {
        if (serviceBindings.eventPersistenceQueues.get(runId) === marker)
          serviceBindings.eventPersistenceQueues.delete(runId);
      },
    );
    serviceBindings.eventPersistenceQueues.set(runId, marker);

    return current;
  };
