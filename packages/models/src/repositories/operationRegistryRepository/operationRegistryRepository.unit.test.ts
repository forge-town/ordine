import { describe, expect, it, vi } from "vitest";
import { createOperationRegistryRepository } from "./operationRegistryRepository";

describe("createOperationRegistryRepository", () => {
  it("runs registry changes in a serializable transaction", async () => {
    const transaction = vi.fn(
      async (callback: (executor: unknown) => Promise<unknown>, config: unknown) =>
        callback({ config }),
    );
    const repository = createOperationRegistryRepository({ transaction } as never);

    const result = await repository.runSerializable(async ({ operationsDao, pipelinesDao }) => ({
      hasOperationsDao: typeof operationsDao.findById === "function",
      hasPipelinesDao: typeof pipelinesDao.findById === "function",
    }));

    expect(result).toEqual({ hasOperationsDao: true, hasPipelinesDao: true });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "serializable",
    });
  });
});
