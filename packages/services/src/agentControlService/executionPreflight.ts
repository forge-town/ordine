import {
  createOperationsDao,
  createPipelinesDao,
  createRoutinesDao,
  type DbConnection,
} from "@repo/models";
import { StrictOperationConfigSchema, type CapabilityCatalogEntry } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import { createCapabilityCatalogService } from "../capabilityCatalogService";

export type ExecutionPreflightError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
};

export type ExecutionPreflightValue = {
  requiresApproval: boolean;
  reasons: string[];
  operationIds: string[];
  pipelineId?: string;
};

const failure = (
  code: string,
  message: string,
  retryable = true,
  field?: string,
): ExecutionPreflightError => ({ code, message, retryable, ...(field ? { field } : {}) });

const riskForReference = (
  reference: string,
  entries: CapabilityCatalogEntry[],
): CapabilityCatalogEntry | null => entries.find((entry) => entry.reference === reference) ?? null;

export const createExecutionPreflight = (db: DbConnection) => {
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const routinesDao = createRoutinesDao(db);
  const capabilityCatalog = createCapabilityCatalogService(db);

  const inspectOperations = async (
    operationIds: string[],
  ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> => {
    const [operations, catalogResult] = await Promise.all([
      Promise.all(operationIds.map((id) => operationsDao.findById(id))),
      capabilityCatalog.getMany(),
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

  return {
    async operation(
      operationId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      return inspectOperations([operationId]);
    },

    async pipeline(
      pipelineId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      const pipeline = await pipelinesDao.findById(pipelineId);
      if (!pipeline) {
        return err(
          failure(
            "PIPELINE_NOT_FOUND",
            `Pipeline "${pipelineId}" was not found.`,
            true,
            "pipelineId",
          ),
        );
      }
      const operationIds = [
        ...new Set(
          pipeline.nodes.flatMap((node) =>
            node.data.nodeType === "operation" ? [node.data.operationId] : [],
          ),
        ),
      ];
      const inspected = await inspectOperations(operationIds);

      return inspected.map((value) => ({ ...value, pipelineId }));
    },

    async routine(
      routineId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      const routine = await routinesDao.findById(routineId);
      if (!routine) {
        return err(
          failure("ROUTINE_NOT_FOUND", `Routine "${routineId}" was not found.`, true, "routineId"),
        );
      }

      return this.pipeline(routine.pipelineId);
    },
  };
};
