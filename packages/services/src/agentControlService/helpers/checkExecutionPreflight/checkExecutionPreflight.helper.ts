import {
  RunPipelineInputSchema,
  RunOperationInputSchema,
  RunRoutineInputSchema,
  type AgentControlToolName,
} from "@repo/agent-control";
import { ok, type Result } from "neverthrow";
import type { ExecutionPreflightValue } from "../executionPreflight";
import type { DomainError, AgentControlServiceBindings } from "../../contracts";
export const createCheckExecutionPreflightHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "preflight">) =>
  async (
    name: AgentControlToolName,
    input: unknown,
  ): Promise<Result<ExecutionPreflightValue | null, DomainError>> => {
    if (name === "ordine.prepare_pipeline_run") {
      const parsed = RunPipelineInputSchema.parse(input);

      return (await serviceBindings.preflight.pipeline(parsed.pipelineId)).map((value) => value);
    }
    if (name === "ordine.prepare_operation_run") {
      const parsed = RunOperationInputSchema.parse(input);

      return (await serviceBindings.preflight.operation(parsed.operationId)).map((value) => value);
    }
    if (name === "ordine.prepare_routine_run") {
      const parsed = RunRoutineInputSchema.parse(input);

      return (await serviceBindings.preflight.routine(parsed.routineId)).map((value) => value);
    }

    return ok(null);
  };
