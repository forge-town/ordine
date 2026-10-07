import "../../../text-imports.d.ts";

import { errAsync, ResultAsync } from "neverthrow";

import { StrictOperationConfigSchema, type AssignedOperationExecutorConfig } from "@repo/schemas";

import { ConflictError, NotFoundError, ServiceError, toServiceError } from "../../../serviceErrors";

import type { PipelinesServiceBindings } from "../../contracts";
export const createUpdateOperationExecutorsMethod =
  (
    serviceBindings: Pick<
      PipelinesServiceBindings,
      "operationsDao" | "getCapabilityCatalog" | "db"
    >,
  ) =>
  (
    updates: Array<{
      operationId: string;
      executor: AssignedOperationExecutorConfig;
    }>,
  ) => {
    const seen = new Set<string>();
    const duplicate = updates.find(({ operationId }) => {
      if (seen.has(operationId)) return true;
      seen.add(operationId);

      return false;
    });
    if (duplicate) {
      return errAsync(new ConflictError(`Duplicate updateOperation for ${duplicate.operationId}`));
    }

    return ResultAsync.fromPromise(
      Promise.all(
        updates.map(async (update) => {
          const operation = await serviceBindings.operationsDao.findById(update.operationId);
          if (!operation) throw new NotFoundError("Operation", update.operationId);

          const parsedConfig = StrictOperationConfigSchema.safeParse(operation.config);
          if (!parsedConfig.success) {
            throw new ServiceError(`Operation:${update.operationId} has invalid stored config`);
          }

          return {
            operationId: update.operationId,
            config: { ...parsedConfig.data, executor: update.executor },
          };
        }),
      ),
      (error) => toServiceError(error, "Prepare operation executor updates"),
    ).andThen((prepared) =>
      (0, serviceBindings.getCapabilityCatalog)(serviceBindings.db)
        .validateOperationConfigs(prepared.map(({ config }) => config))
        .andThen(() =>
          ResultAsync.fromPromise(
            (async () => {
              for (const { operationId, config } of prepared) {
                await serviceBindings.operationsDao.update(operationId, { config });
              }
            })(),
            (error) => toServiceError(error, "Update operation executors"),
          ),
        ),
    );
  };
