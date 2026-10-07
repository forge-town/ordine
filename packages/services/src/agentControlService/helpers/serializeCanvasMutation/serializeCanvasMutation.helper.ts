import type { AgentControlServiceBindings } from "../../contracts";
export const createSerializeCanvasMutationHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "canvasMutationQueues">) =>
  async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const previous = serviceBindings.canvasMutationQueues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    serviceBindings.canvasMutationQueues.set(key, tail);

    return current.finally(() => {
      if (serviceBindings.canvasMutationQueues.get(key) === tail)
        serviceBindings.canvasMutationQueues.delete(key);
    });
  };
