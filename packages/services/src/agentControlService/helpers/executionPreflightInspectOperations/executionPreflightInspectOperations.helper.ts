import { StrictOperationConfigSchema } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";

import type { ExecutionPreflightError, ExecutionPreflightValue } from "../executionPreflight";
import { failure } from "../executionPreflightFailure";
import { riskForReference } from "../executionPreflightRiskForReference";

import type { ExecutionPreflightBindings } from "../../contracts";
export const createExecutionPreflightInspectOperationsHelper =
  (serviceBindings: Pick<ExecutionPreflightBindings, "operationsDao" | "capabilityCatalog">) =>
  async (
    operationIds: string[],
  ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> => {
    const [operations, catalogResult] = await Promise.all([
      Promise.all(operationIds.map((id) => serviceBindings.operationsDao.findById(id))),
      serviceBindings.capabilityCatalog.getMany(),
    ]);
    if (catalogResult.isErr()) {
      return err(failure("CAPABILITY_CATALOG_FAILED", catalogResult.error.message, false));
    }
    const missingIndex = operations.findIndex((operation) => !operation);
    if (missingIndex !== -1) {
      return err(
        failure(
          "OPERATION_NOT_FOUND",
          `Operation "${operationIds[missingIndex]}" was not found.`,
          true,
          "operationId",
        ),
      );
    }
    const reasons: string[] = [];
    for (const operation of operations) {
      const parsed = StrictOperationConfigSchema.safeParse(operation!.config);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];

        return err(
          failure(
            "INVALID_OPERATION_CONFIG",
            `${operation!.id}: ${issue?.message ?? "invalid Operation config"}`,
            true,
            issue?.path.length ? `operation.config.${issue.path.join(".")}` : "operation.config",
          ),
        );
      }
      const executor = parsed.data.executor;
      if (!executor) {
        return err(
          failure(
            "OPERATION_EXECUTOR_MISSING",
            `Operation "${operation!.id}" has no executor.`,
            true,
            "operation.config.executor",
          ),
        );
      }
      if (executor.type === "script") {
        reasons.push(`Operation ${operation!.id} executes an arbitrary script command`);
      }
      const references = [
        ...(executor.allowedTools ?? []),
        ...(executor.skillId ? [executor.skillId] : []),
        ...(operation!.sourceSkillId ? [operation!.sourceSkillId] : []),
      ];
      for (const reference of references) {
        const entry = riskForReference(reference, catalogResult.value);
        if (!entry) {
          return err(
            failure(
              "CAPABILITY_NOT_FOUND",
              `Operation "${operation!.id}" references unavailable capability "${reference}".`,
              true,
              "operation.config.executor",
            ),
          );
        }
        if (entry.riskTier === "irreversible") {
          reasons.push(
            `Operation ${operation!.id} uses irreversible capability ${entry.displayName}`,
          );
        }
      }
    }

    return ok({
      requiresApproval: reasons.length > 0,
      reasons: [...new Set(reasons)],
      operationIds,
    });
  };
