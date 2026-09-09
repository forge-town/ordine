import { ResultAsync, errAsync } from "neverthrow";
import { ExecutionMigrationImportError, type ExecutionMigrationRepository } from "@repo/models";
import {
  ExecutionMigrationValidationError,
  validateExecutionMigration,
} from "./validateExecutionMigration";

export const createExecutionMigrationService = (dependencies: {
  repository: ExecutionMigrationRepository;
}) => ({
  importBundle(bundle: unknown, sourceBytes: Uint8Array) {
    const validated = validateExecutionMigration(bundle, sourceBytes);
    if (validated.isErr()) return errAsync(validated.error);
    const { bundle: data, report } = validated.value;

    return ResultAsync.fromPromise(
      dependencies.repository.importIntoEmptyWorkspace({
        workspaceId: data.targetWorkspaceId,
        confirmNewWorkspace: true,
        operations: data.operations,
        pipelines: data.pipelines,
      }),
      (error) =>
        new ExecutionMigrationValidationError(
          error instanceof ExecutionMigrationImportError ? error.code : "atomic_import_failed",
        ),
    ).map(() => ({ ...report, imported: true }));
  },
});
