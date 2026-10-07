import "../../../text-imports.d.ts";

import { ResultAsync } from "neverthrow";

import { toServiceError } from "../../../serviceErrors";

import type { PendingOperationInput } from "../../pipelines.service";

import type { PipelinesServiceBindings } from "../../contracts";
export const createCreatePendingOperationsMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "db" | "insertPendingOperations">) =>
  (pendingOperations: PendingOperationInput[]) =>
    ResultAsync.fromPromise(
      serviceBindings.db.transaction((transaction) =>
        (0, serviceBindings.insertPendingOperations)(transaction, pendingOperations),
      ),
      (error) => toServiceError(error, "Create pending operations"),
    );
