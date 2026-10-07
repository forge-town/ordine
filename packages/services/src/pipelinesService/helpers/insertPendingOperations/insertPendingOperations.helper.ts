import "../../../text-imports.d.ts";

import { createOperationsDao, type DbExecutor } from "@repo/models";

import type { PendingOperationInput } from "../../pipelines.service";

import type { PipelinesServiceBindings } from "../../contracts";
export const createInsertPendingOperationsHelper =
  (serviceBindings: Pick<PipelinesServiceBindings, "getCapabilityCatalog">) =>
  async (executor: DbExecutor, pendingOperations: PendingOperationInput[]): Promise<void> => {
    const validation = await (0, serviceBindings.getCapabilityCatalog)(
      executor,
    ).validateOperationInputs(pendingOperations);
    if (validation.isErr()) throw validation.error;

    const transactionalOperationsDao = createOperationsDao(executor);
    for (const operation of pendingOperations) {
      await transactionalOperationsDao.create(operation);
    }
  };
