import type { createExecutionPreflightPipelineMethod } from "../executionPreflightPipeline";
import { err, type Result } from "neverthrow";

import type {
  ExecutionPreflightError,
  ExecutionPreflightValue,
} from "../../helpers/executionPreflight";
import { failure } from "../../helpers/executionPreflightFailure";

import type { ExecutionPreflightBindings } from "../../contracts";
export const createExecutionPreflightRoutineMethod = (
  serviceBindings: Pick<ExecutionPreflightBindings, "routinesDao">,
) =>
  ({
    async routine(
      routineId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      const routine = await serviceBindings.routinesDao.findById(routineId);
      if (!routine) {
        return err(
          failure("ROUTINE_NOT_FOUND", `Routine "${routineId}" was not found.`, true, "routineId"),
        );
      }

      return (
        this as unknown as { pipeline: ReturnType<typeof createExecutionPreflightPipelineMethod> }
      ).pipeline(routine.pipelineId);
    },
  }).routine;
