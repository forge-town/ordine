import { createOperationsDao } from "../../daos/operationsDao";
import { createPipelinesDao } from "../../daos/pipelinesDao";
import type { DbConnection, DbExecutor } from "../../types";

export interface OperationRegistryTransaction {
  executor: DbExecutor;
  operationsDao: ReturnType<typeof createOperationsDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
}

export const createOperationRegistryRepository = (db: DbConnection) => ({
  runSerializable: <T>(
    callback: (transaction: OperationRegistryTransaction) => Promise<T>,
  ): Promise<T> =>
    db.transaction(
      async (transaction) =>
        callback({
          executor: transaction,
          operationsDao: createOperationsDao(transaction),
          pipelinesDao: createPipelinesDao(transaction),
        }),
      { isolationLevel: "serializable" },
    ),
});
