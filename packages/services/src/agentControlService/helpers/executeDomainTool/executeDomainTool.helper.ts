import {
  ArchiveResourceInputSchema,
  ControlJobInputSchema,
  CreateResourceInputSchema,
  DeleteResourceInputSchema,
  DescribeResourceInputSchema,
  FinishCanvasEditInputSchema,
  GetJobTraceInputSchema,
  GetResourceInputSchema,
  InspectCanvasInputSchema,
  RunOperationInputSchema,
  RunPipelineInputSchema,
  RunRoutineInputSchema,
  SearchResourcesInputSchema,
  TestConnectorInputSchema,
  UpdateResourceInputSchema,
  ValidateCanvasInputSchema,
  type AgentControlToolName,
} from "@repo/agent-control";

import { err, ok, type Result } from "neverthrow";

import type { MutableAgentResourceType } from "../resourceControl";
import {
  MAX_TRACE_MESSAGE_CHARS,
  type DomainError,
  type DomainValue,
  type AgentControlServiceBindings,
} from "../../contracts";

import { preparedSubmissionValue } from "../preparedSubmissionValue";

export const createExecuteDomainToolHelper =
  (
    serviceBindings: Pick<
      AgentControlServiceBindings,
      | "resources"
      | "pipelinesDao"
      | "canvas"
      | "options"
      | "changeSetsDao"
      | "jobsDao"
      | "tracesDao"
    >,
  ) =>
  async (
    name: AgentControlToolName,
    input: unknown,
    threadId: string,
    actionId: string,
  ): Promise<Result<DomainValue, DomainError>> => {
    switch (name) {
      case "ordine.search": {
        const parsed = SearchResourcesInputSchema.parse(input);

        return serviceBindings.resources.search(parsed);
      }
      case "ordine.get_resource": {
        const parsed = GetResourceInputSchema.parse(input);

        return serviceBindings.resources.get(parsed.resourceType, parsed.id);
      }
      case "ordine.describe_resource": {
        const parsed = DescribeResourceInputSchema.parse(input);

        return serviceBindings.resources.describe(parsed.resourceType);
      }
      case "ordine.create_resource": {
        const parsed = CreateResourceInputSchema.parse(input);

        return serviceBindings.resources.create(
          parsed.resourceType as MutableAgentResourceType,
          parsed.data,
        );
      }
      case "ordine.update_resource": {
        const parsed = UpdateResourceInputSchema.parse(input);

        return serviceBindings.resources.update(
          parsed.resourceType as MutableAgentResourceType,
          parsed.id,
          parsed.patch,
          parsed.expectedVersion,
        );
      }
      case "ordine.archive_resource": {
        const parsed = ArchiveResourceInputSchema.parse(input);

        return serviceBindings.resources.archive(
          parsed.resourceType,
          parsed.id,
          parsed.expectedVersion,
        );
      }
      case "ordine.delete_resource": {
        const parsed = DeleteResourceInputSchema.parse(input);
        if (parsed.resourceType === "pipeline") {
          const pipeline = await serviceBindings.pipelinesDao.findById(parsed.id);
          if (!pipeline) {
            return err({
              code: "RESOURCE_NOT_FOUND",
              message: `pipeline:${parsed.id} was not found`,
              retryable: true,
            });
          }
          if (!parsed.expectedVersion || parsed.expectedVersion !== pipeline.version) {
            return err({
              code: "VERSION_CONFLICT",
              message: `Pipeline version is ${pipeline.version}; delete approval expected ${parsed.expectedVersion ?? "no version"}.`,
              retryable: true,
              field: "expectedVersion",
            });
          }
        }

        return serviceBindings.resources.delete(
          parsed.resourceType as MutableAgentResourceType,
          parsed.id,
        );
      }
      case "ordine.inspect_canvas": {
        const parsed = InspectCanvasInputSchema.parse(input);

        return serviceBindings.canvas.inspect({ ...parsed, threadId });
      }
      case "ordine.validate_canvas": {
        const parsed = ValidateCanvasInputSchema.parse(input);
        if (parsed.threadId !== threadId) {
          return err({
            code: "THREAD_BINDING_MISMATCH",
            message: "The tool input threadId does not match the authenticated Agent thread.",
            retryable: false,
            field: "threadId",
          });
        }

        return serviceBindings.canvas.validate({ ...parsed, actionId });
      }
      case "ordine.finish_canvas_edit": {
        const parsed = FinishCanvasEditInputSchema.parse(input);
        if (parsed.threadId !== threadId) {
          return err({
            code: "THREAD_BINDING_MISMATCH",
            message: "The tool input threadId does not match the authenticated Agent thread.",
            retryable: false,
            field: "threadId",
          });
        }

        return serviceBindings.canvas.finish({ ...parsed, actionId });
      }
      case "ordine.prepare_pipeline_run": {
        if (!serviceBindings.options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Pipeline execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunPipelineInputSchema.parse(input);
        const pending = await serviceBindings.changeSetsDao.findActive(
          threadId,
          "pipeline",
          parsed.pipelineId,
        );
        if (pending)
          return err({
            code: "CANVAS_NOT_APPLIED",
            message:
              "The Canvas Change Set has not been applied. Ask the user to click Apply and save, then wait for their confirmation before preparing the run.",
            retryable: false,
          });
        const result = await serviceBindings.options.execution.runPipeline({
          pipelineId: parsed.pipelineId,
          inputs: parsed.inputs,
          ...(serviceBindings.options.execution.submissionMode === "prepared-run"
            ? { requestId: actionId }
            : {}),
        });
        if (result.isErr())
          return err({
            code: "PIPELINE_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

        if (serviceBindings.options.execution.submissionMode === "prepared-run")
          return preparedSubmissionValue({ type: "pipeline", id: parsed.pipelineId }, result.value);

        return ok({
          resources: [
            { type: "pipeline", id: parsed.pipelineId },
            { type: "job", id: String(result.value.jobId) },
          ],
          summary: `Started Pipeline ${parsed.pipelineId} as Job ${String(result.value.jobId)}.`,
          data: result.value,
        });
      }
      case "ordine.prepare_operation_run": {
        if (!serviceBindings.options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Operation execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunOperationInputSchema.parse(input);
        const result = await serviceBindings.options.execution.runOperation({
          operationId: parsed.operationId,
          inputs: parsed.inputs,
          ...(serviceBindings.options.execution.submissionMode === "prepared-run"
            ? { requestId: actionId }
            : {}),
        });
        if (result.isErr())
          return err({
            code: "OPERATION_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

        if (serviceBindings.options.execution.submissionMode === "prepared-run")
          return preparedSubmissionValue(
            { type: "operation", id: parsed.operationId },
            result.value,
          );

        return ok({
          resources: [
            { type: "operation", id: parsed.operationId },
            { type: "job", id: String(result.value.jobId) },
          ],
          summary: `Started Operation ${parsed.operationId} as Job ${String(result.value.jobId)}.`,
          data: result.value,
        });
      }
      case "ordine.prepare_routine_run": {
        if (!serviceBindings.options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Routine execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunRoutineInputSchema.parse(input);
        const result = await serviceBindings.options.execution.runRoutine(
          parsed.routineId,
          serviceBindings.options.execution.submissionMode === "prepared-run"
            ? actionId
            : undefined,
        );
        if (result.isErr())
          return err({
            code: "ROUTINE_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

        if (serviceBindings.options.execution.submissionMode === "prepared-run")
          return preparedSubmissionValue({ type: "routine", id: parsed.routineId }, result.value);

        return ok({
          resources: [
            { type: "routine", id: parsed.routineId },
            { type: "job", id: String(result.value.jobId) },
          ],
          summary: `Started Routine ${parsed.routineId} as Job ${String(result.value.jobId)}.`,
          data: result.value,
        });
      }
      case "ordine.control_job": {
        if (!serviceBindings.options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Job control is unavailable.",
            retryable: false,
          });
        }
        const parsed = ControlJobInputSchema.parse(input);
        const result = await serviceBindings.options.execution.controlJob(
          parsed.jobId,
          parsed.action,
        );
        if (result.isErr())
          return err({
            code: "JOB_CONTROL_FAILED",
            message: result.error.message,
            retryable: true,
          });

        return ok({
          resources: [{ type: "job", id: parsed.jobId }],
          summary: `${parsed.action} requested for Job ${parsed.jobId}.`,
          data: result.value,
        });
      }
      case "ordine.get_job_trace": {
        const parsed = GetJobTraceInputSchema.parse(input);
        if (serviceBindings.options.execution?.submissionMode === "prepared-run") {
          const afterSequence = parsed.cursor ? Number(parsed.cursor) : 0;
          if (!Number.isSafeInteger(afterSequence) || afterSequence < 0)
            return err({
              code: "INVALID_CURSOR",
              message: "cursor must be a non-negative event sequence",
              retryable: true,
            });
          if (!serviceBindings.options.execution.getJobTrace)
            return err({
              code: "EXECUTION_UNAVAILABLE",
              message: "Execution trace reader is not configured.",
              retryable: false,
            });
          const result = await serviceBindings.options.execution.getJobTrace(
            parsed.jobId,
            afterSequence,
          );
          if (result.isErr())
            return err({
              code: "EXECUTION_TRACE_FAILED",
              message: result.error.message,
              retryable: true,
            });

          return ok({
            resources: [{ type: "job", id: parsed.jobId }],
            summary: `Read execution state, events and published artifact metadata for Job ${parsed.jobId}.`,
            data: result.value,
          });
        }
        const job = await serviceBindings.jobsDao.findById(parsed.jobId);
        if (!job)
          return err({
            code: "JOB_NOT_FOUND",
            message: `Job ${parsed.jobId} was not found.`,
            retryable: true,
          });
        const offset = parsed.cursor ? Number.parseInt(parsed.cursor, 10) : 0;
        if (!Number.isSafeInteger(offset) || offset < 0) {
          return err({
            code: "INVALID_CURSOR",
            message: "cursor must be a non-negative integer",
            retryable: true,
            field: "cursor",
          });
        }
        const all = await serviceBindings.tracesDao.findByJobId(parsed.jobId);
        const filtered = parsed.status && job.status !== parsed.status ? [] : all;
        const page = filtered.slice(offset, offset + parsed.limit);

        return ok({
          resources: [{ type: "job", id: parsed.jobId, label: job.title }],
          summary: `Returned ${page.length} of ${filtered.length} trace events for Job ${parsed.jobId}.`,
          data: {
            job: { id: job.id, status: job.status, title: job.title },
            traces: page.map((trace) => ({
              ...trace,
              message:
                trace.message.length > MAX_TRACE_MESSAGE_CHARS
                  ? `${trace.message.slice(0, MAX_TRACE_MESSAGE_CHARS)}…`
                  : trace.message,
            })),
            nextCursor:
              offset + page.length < filtered.length ? String(offset + page.length) : null,
          },
          warnings:
            parsed.status && job.status !== parsed.status
              ? [`Job status is ${job.status}, not ${parsed.status}.`]
              : [],
        });
      }
      case "ordine.test_connector": {
        const parsed = TestConnectorInputSchema.parse(input);

        return serviceBindings.resources.testConnector(parsed.connectorId);
      }
      default: {
        return err({
          code: "TOOL_NOT_IMPLEMENTED",
          message: `${name} is not implemented.`,
          retryable: false,
        });
      }
    }
  };
