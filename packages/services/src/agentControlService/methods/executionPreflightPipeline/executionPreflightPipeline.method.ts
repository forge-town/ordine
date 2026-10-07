import { err, type Result } from "neverthrow";

import type {
  ExecutionPreflightError,
  ExecutionPreflightValue,
} from "../../helpers/executionPreflight";
import { failure } from "../../helpers/executionPreflightFailure";

import type { ExecutionPreflightBindings } from "../../contracts";
export const createExecutionPreflightPipelineMethod = (
  serviceBindings: Pick<ExecutionPreflightBindings, "pipelinesDao" | "inspectOperations">,
) =>
  ({
    async pipeline(
      pipelineId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      const pipeline = await serviceBindings.pipelinesDao.findById(pipelineId);
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
      const inspected = await (0, serviceBindings.inspectOperations)(operationIds);

      return inspected.map((value) => ({ ...value, pipelineId }));
    },
  }).pipeline;
