import { createHash, randomUUID } from "node:crypto";
import { z } from "zod/v4";
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
  findAgentControlTool,
  parseAgentControlToolInput,
  redactAgentControlInput,
  redactAgentControlResult,
  type AgentControlInvocationContext,
  type AgentControlToolName,
} from "@repo/agent-control";
import {
  createAgentActionsDao,
  createAgentApprovalsDao,
  createAgentChangeSetsDao,
  createAgentControlRepository,
  createAgentThreadsDao,
  createJobsDao,
  createJobTracesDao,
  createPipelinesDao,
  type DbConnection,
} from "@repo/models";
import {
  AgentActionSchema,
  AgentApprovalSchema,
  AgentChangeSetSchema,
  AgentControlEventSchema,
  AgentControlToolResultSchema,
  type AgentControlEvent,
  type AgentControlToolResult,
  type AgentResourceRef,
  type AgentRuntime,
  type AgentRunStatus,
} from "@repo/schemas";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { createCanvasControl, type CanvasReadValue } from "./canvasControl";
import { canAppendControlRunEvent } from "./controlRunEvent";
import { createExecutionPreflight, type ExecutionPreflightValue } from "./executionPreflight";
import {
  createResourceControl,
  type MutableAgentResourceType,
  type ResourceControlValue,
} from "./resourceControl";

const APPROVAL_TTL_MS = 10 * 60 * 1_000;
const MAX_TRACE_MESSAGE_CHARS = 4_000;

type DomainError = {
  code: string;
  message: string;
  retryable: boolean;
  field?: string;
  nodeId?: string;
  portId?: string;
};
type DomainValue = ResourceControlValue | CanvasReadValue;

type ExecutionResult = Result<Record<string, unknown>, Error>;

export type AgentControlExecutionPorts = {
  runPipeline: (input: {
    pipelineId: string;
    inputs?: Record<string, string>;
  }) => Promise<ExecutionResult>;
  runOperation: (input: { operationId: string; inputContent?: string }) => Promise<ExecutionResult>;
  runRoutine: (routineId: string) => Promise<ExecutionResult>;
  controlJob: (jobId: string, action: "pause" | "resume" | "cancel") => Promise<ExecutionResult>;
};

export type AgentControlRunEventPort = {
  getRun: (runId: string) => Promise<{
    runtime: AgentRuntime;
    controlMode: boolean;
    status: AgentRunStatus;
  } | null>;
  append: (runId: string, event: AgentControlEvent) => Promise<unknown>;
};

export type AgentControlServiceOptions = {
  execution?: AgentControlExecutionPorts;
  runEvents?: AgentControlRunEventPort;
};

type PersistedAction = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAgentActionsDao>["findById"]>>
>;

type InvocationState = {
  actionId: string | null;
  runId: string | null;
  toolName: string | null;
  resources: AgentResourceRef[];
};

const toPublicAction = (row: PersistedAction) =>
  AgentActionSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    changeSetId: row.changeSetId,
    sequence: row.sequence,
    toolName: row.toolName,
    risk: row.risk,
    status: row.status,
    target: row.targetType && row.targetId ? { type: row.targetType, id: row.targetId } : null,
    redactedInput: row.redactedInput,
    result: row.result,
    forwardAction: row.forwardAction,
    inverseActions: row.inverseActions,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  });

const toPublicChangeSet = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentChangeSetsDao>["findById"]>>>,
) =>
  AgentChangeSetSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    actor: row.actor,
    kind: row.kind,
    originChangeSetId: row.originChangeSetId,
    target: { type: row.targetType, id: row.targetId },
    baseVersion: row.baseVersion,
    revision: row.revision,
    appliedVersion: row.appliedVersion,
    status: row.status,
    baseSnapshot: row.baseSnapshot,
    draftSnapshot: row.draftSnapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    committedAt: row.committedAt?.toISOString() ?? null,
  });

const toPublicApproval = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentApprovalsDao>["findById"]>>>,
) =>
  AgentApprovalSchema.parse({
    id: row.id,
    threadId: row.threadId,
    runId: row.runId,
    actionId: row.actionId,
    toolName: row.toolName,
    callId: row.callId,
    argumentDigest: row.argumentDigest,
    target: row.targetType && row.targetId ? { type: row.targetType, id: row.targetId } : null,
    resourceVersion: row.resourceVersion,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  });

const failureResult = ({
  actionId,
  error,
  resources = [],
}: {
  actionId: string;
  error: DomainError;
  resources?: AgentResourceRef[];
}): AgentControlToolResult =>
  AgentControlToolResultSchema.parse({
    actionId,
    status: "failed",
    resources,
    summary: error.message,
    warnings: [],
    retry: {
      retryable: error.retryable,
      code: error.code,
      message: error.message,
      ...(error.field ? { field: error.field } : {}),
      ...(error.nodeId ? { nodeId: error.nodeId } : {}),
      ...(error.portId ? { portId: error.portId } : {}),
    },
  });

const successResult = (actionId: string, value: DomainValue): AgentControlToolResult =>
  AgentControlToolResultSchema.parse({
    actionId,
    status: "succeeded",
    resources: value.resources,
    summary: value.summary,
    warnings: value.warnings ?? [],
    ...(value.data ? { data: redactAgentControlResult(value.data) } : {}),
  });

const replayResult = (action: PersistedAction): AgentControlToolResult => {
  const parsed = AgentControlToolResultSchema.safeParse(action.result);
  if (!parsed.success) {
    return failureResult({
      actionId: action.id,
      error: {
        code: "ACTION_IN_PROGRESS",
        message: "The matching callId is still incomplete; retry after the current call settles.",
        retryable: true,
      },
    });
  }

  return action.status === "succeeded"
    ? AgentControlToolResultSchema.parse({ ...parsed.data, status: "replayed" })
    : parsed.data;
};

const normalizeForDigest = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForDigest);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([key]) =>
          !["approvalRequestId", "callId", "changeSetId", "runId", "threadId"].includes(key),
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeForDigest(child)]),
  );
};

export const digestAgentControlArguments = (input: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeForDigest(input)))
    .digest("hex");

const persistedArgumentDigest = (action: PersistedAction): string =>
  action.argumentDigest ?? digestAgentControlArguments(action.redactedInput);

const idempotencyMismatchResult = (
  action: PersistedAction,
  argumentDigest: string,
  resources: AgentResourceRef[],
): AgentControlToolResult | null =>
  persistedArgumentDigest(action) === argumentDigest
    ? null
    : failureResult({
        actionId: action.id,
        error: {
          code: "IDEMPOTENCY_ARGUMENT_MISMATCH",
          message: "callId was already used with different arguments; retry with a new callId.",
          retryable: false,
          field: "callId",
        },
        resources,
      });

const callIdFrom = (input: unknown): string | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const callId = (input as Record<string, unknown>).callId;

  return typeof callId === "string" ? callId : null;
};

const approvalRequestIdFrom = (input: unknown): string | null => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const approvalRequestId = (input as Record<string, unknown>).approvalRequestId;

  return typeof approvalRequestId === "string" ? approvalRequestId : null;
};

const targetFrom = (name: AgentControlToolName, input: unknown): AgentResourceRef | null => {
  const value = input as Record<string, unknown>;
  if (
    name === "ordine.get_resource" ||
    name === "ordine.update_resource" ||
    name === "ordine.archive_resource" ||
    name === "ordine.delete_resource"
  ) {
    return {
      type: value.resourceType as AgentResourceRef["type"],
      id: String(value.id),
    };
  }
  if (name === "ordine.create_resource") {
    const data = value.data as Record<string, unknown>;

    return typeof data.id === "string"
      ? { type: value.resourceType as AgentResourceRef["type"], id: data.id }
      : null;
  }
  if (name.includes("canvas") || name.includes("node") || name.includes("edge")) {
    return typeof value.pipelineId === "string" ? { type: "pipeline", id: value.pipelineId } : null;
  }
  if (name === "ordine.run_pipeline") return { type: "pipeline", id: String(value.pipelineId) };
  if (name === "ordine.run_operation") return { type: "operation", id: String(value.operationId) };
  if (name === "ordine.run_routine") return { type: "routine", id: String(value.routineId) };
  if (name === "ordine.control_job" || name === "ordine.get_job_trace") {
    return { type: "job", id: String(value.jobId) };
  }
  if (name === "ordine.test_connector") return { type: "connector", id: String(value.connectorId) };

  return null;
};

const toStringInputs = (input?: Record<string, unknown>): Record<string, string> | undefined => {
  if (!input) return undefined;

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ]),
  );
};

const navigationPath = (resource: AgentResourceRef): string => {
  const plural = resource.type === "pipeline-asset" ? "pipeline-assets" : `${resource.type}s`;

  return `/${plural}/${encodeURIComponent(resource.id)}`;
};

const unexpectedError = (error: unknown): DomainError => ({
  code: "AGENT_CONTROL_INTERNAL_ERROR",
  message: error instanceof Error ? error.message : "Agent Control failed unexpectedly",
  retryable: false,
});

export const createAgentControlService = (
  db: DbConnection,
  options: AgentControlServiceOptions = {},
) => {
  const actionsDao = createAgentActionsDao(db);
  const approvalsDao = createAgentApprovalsDao(db);
  const changeSetsDao = createAgentChangeSetsDao(db);
  const threadsDao = createAgentThreadsDao(db);
  const jobsDao = createJobsDao(db);
  const tracesDao = createJobTracesDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const repository = createAgentControlRepository(db);
  const resources = createResourceControl(db);
  const canvas = createCanvasControl(db, digestAgentControlArguments);
  const preflight = createExecutionPreflight(db);
  const canvasMutationQueues = new Map<string, Promise<void>>();

  const serializeCanvasMutation = async <T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const previous = canvasMutationQueues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const tail = current.then(
      () => undefined,
      () => undefined,
    );
    canvasMutationQueues.set(key, tail);

    return current.finally(() => {
      if (canvasMutationQueues.get(key) === tail) canvasMutationQueues.delete(key);
    });
  };

  const emit = async (
    runId: string | null,
    payload: Record<string, unknown> & { type: AgentControlEvent["type"] },
  ): Promise<void> => {
    if (!runId || !options.runEvents) return;
    const run = await options.runEvents.getRun(runId);
    if (!run || !canAppendControlRunEvent(run)) return;
    const event = AgentControlEventSchema.parse({
      ...payload,
      runtime: run.runtime,
      timestamp: new Date().toISOString(),
    });
    await options.runEvents.append(runId, event);
  };

  const ensureThread = async (context: AgentControlInvocationContext): Promise<string> => {
    const id = context.threadId ?? `agent-control-${context.audience}-local-owner`;
    const applicationThread = context.audience === "internal-run" && Boolean(context.threadId);
    const existing = await threadsDao.ensure({
      id,
      title: context.threadId ? "Agent thread" : `${context.audience} Agent Control`,
      entrypoint: applicationThread ? "global-agent-bar" : "agent-control-external",
    });
    if (!existing) throw new Error(`Unable to create or load Agent thread ${id}`);

    return id;
  };

  const persistFailure = async ({
    actionId,
    toolName,
    runId,
    error,
    resources: targetResources = [],
  }: {
    actionId: string;
    toolName: string;
    runId: string | null;
    error: DomainError;
    resources?: AgentResourceRef[];
  }): Promise<AgentControlToolResult> => {
    const result = failureResult({ actionId, error, resources: targetResources });
    await actionsDao.update(actionId, {
      status: "failed",
      result,
      completedAt: new Date(),
    });
    await emit(runId, {
      type: "action_failed",
      actionId,
      toolName,
      error: result.retry!,
    });

    return result;
  };

  const executionPreflight = async (
    name: AgentControlToolName,
    input: unknown,
  ): Promise<Result<ExecutionPreflightValue | null, DomainError>> => {
    if (name === "ordine.run_pipeline") {
      const parsed = RunPipelineInputSchema.parse(input);

      return (await preflight.pipeline(parsed.pipelineId)).map((value) => value);
    }
    if (name === "ordine.run_operation") {
      const parsed = RunOperationInputSchema.parse(input);

      return (await preflight.operation(parsed.operationId)).map((value) => value);
    }
    if (name === "ordine.run_routine") {
      const parsed = RunRoutineInputSchema.parse(input);

      return (await preflight.routine(parsed.routineId)).map((value) => value);
    }

    return ok(null);
  };

  const executeDomainTool = async (
    name: AgentControlToolName,
    input: unknown,
    threadId: string,
    actionId: string,
  ): Promise<Result<DomainValue, DomainError>> => {
    switch (name) {
      case "ordine.search": {
        const parsed = SearchResourcesInputSchema.parse(input);

        return resources.search(parsed);
      }
      case "ordine.get_resource": {
        const parsed = GetResourceInputSchema.parse(input);

        return resources.get(parsed.resourceType, parsed.id);
      }
      case "ordine.describe_resource": {
        const parsed = DescribeResourceInputSchema.parse(input);

        return resources.describe(parsed.resourceType);
      }
      case "ordine.create_resource": {
        const parsed = CreateResourceInputSchema.parse(input);

        return resources.create(parsed.resourceType as MutableAgentResourceType, parsed.data);
      }
      case "ordine.update_resource": {
        const parsed = UpdateResourceInputSchema.parse(input);

        return resources.update(
          parsed.resourceType as MutableAgentResourceType,
          parsed.id,
          parsed.patch,
          parsed.expectedVersion,
        );
      }
      case "ordine.archive_resource": {
        const parsed = ArchiveResourceInputSchema.parse(input);

        return resources.archive(parsed.resourceType, parsed.id, parsed.expectedVersion);
      }
      case "ordine.delete_resource": {
        const parsed = DeleteResourceInputSchema.parse(input);
        if (parsed.resourceType === "pipeline") {
          const pipeline = await pipelinesDao.findById(parsed.id);
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

        return resources.delete(parsed.resourceType as MutableAgentResourceType, parsed.id);
      }
      case "ordine.inspect_canvas": {
        const parsed = InspectCanvasInputSchema.parse(input);

        return canvas.inspect({ ...parsed, threadId });
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

        return canvas.validate({ ...parsed, actionId });
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

        return canvas.finish({ ...parsed, actionId });
      }
      case "ordine.run_pipeline": {
        if (!options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Pipeline execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunPipelineInputSchema.parse(input);
        const result = await options.execution.runPipeline({
          pipelineId: parsed.pipelineId,
          inputs: toStringInputs(parsed.input),
        });
        if (result.isErr())
          return err({
            code: "PIPELINE_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

        return ok({
          resources: [
            { type: "pipeline", id: parsed.pipelineId },
            { type: "job", id: String(result.value.jobId) },
          ],
          summary: `Started Pipeline ${parsed.pipelineId} as Job ${String(result.value.jobId)}.`,
          data: result.value,
        });
      }
      case "ordine.run_operation": {
        if (!options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Operation execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunOperationInputSchema.parse(input);
        const result = await options.execution.runOperation({
          operationId: parsed.operationId,
          inputContent: parsed.input ? JSON.stringify(parsed.input) : undefined,
        });
        if (result.isErr())
          return err({
            code: "OPERATION_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

        return ok({
          resources: [
            { type: "operation", id: parsed.operationId },
            { type: "job", id: String(result.value.jobId) },
          ],
          summary: `Started Operation ${parsed.operationId} as Job ${String(result.value.jobId)}.`,
          data: result.value,
        });
      }
      case "ordine.run_routine": {
        if (!options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Routine execution is unavailable.",
            retryable: false,
          });
        }
        const parsed = RunRoutineInputSchema.parse(input);
        const result = await options.execution.runRoutine(parsed.routineId);
        if (result.isErr())
          return err({
            code: "ROUTINE_RUN_FAILED",
            message: result.error.message,
            retryable: true,
          });

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
        if (!options.execution) {
          return err({
            code: "EXECUTION_UNAVAILABLE",
            message: "Job control is unavailable.",
            retryable: false,
          });
        }
        const parsed = ControlJobInputSchema.parse(input);
        const result = await options.execution.controlJob(parsed.jobId, parsed.action);
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
        const job = await jobsDao.findById(parsed.jobId);
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
        const all = await tracesDao.findByJobId(parsed.jobId);
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

        return resources.testConnector(parsed.connectorId);
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

  const requestApproval = async ({
    actionId,
    definition,
    input,
    threadId,
    runId,
    target,
    redactedInput,
    reasons,
  }: {
    actionId: string;
    definition: NonNullable<ReturnType<typeof findAgentControlTool>>;
    input: unknown;
    threadId: string;
    runId: string | null;
    target: AgentResourceRef | null;
    redactedInput: Record<string, unknown>;
    reasons: string[];
  }): Promise<AgentControlToolResult> => {
    const callId = callIdFrom(input)!;
    const argumentDigest = digestAgentControlArguments(input);
    const approvalId = randomUUID();
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
    const summary = reasons.length
      ? `Approval required: ${reasons.join("; ")}`
      : `Approval required before ${definition.title}.`;
    const requestedResult = AgentControlToolResultSchema.parse({
      actionId,
      status: "approval_required",
      resources: target ? [target] : [],
      summary,
      warnings: [],
      approvalRequestId: approvalId,
      data: { expiresAt: expiresAt.toISOString() },
    });
    const resourceVersion =
      input && typeof input === "object" && !Array.isArray(input)
        ? ((input as Record<string, unknown>).expectedVersion as number | undefined)
        : undefined;
    const persisted = await repository.requestApproval({
      action: {
        id: actionId,
        threadId,
        runId,
        changeSetId: null,
        toolName: definition.name,
        risk: definition.risk,
        status: "approval_required",
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        redactedInput,
        result: requestedResult,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: callId,
        argumentDigest,
        completedAt: null,
      },
      approval: {
        id: approvalId,
        threadId,
        runId,
        actionId,
        toolName: definition.name,
        callId,
        argumentDigest,
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        resourceVersion: resourceVersion ?? null,
        status: "pending",
        expiresAt,
        approvedAt: null,
        consumedAt: null,
      },
    });
    if (persisted.approval.argumentDigest !== argumentDigest) {
      return failureResult({
        actionId: persisted.action.id,
        error: {
          code: "IDEMPOTENCY_ARGUMENT_MISMATCH",
          message: "callId was already used with different arguments; retry with a new callId.",
          retryable: false,
          field: "callId",
        },
        resources: target ? [target] : [],
      });
    }
    const result = AgentControlToolResultSchema.parse({
      actionId: persisted.action.id,
      status: "approval_required",
      resources: target ? [target] : [],
      summary,
      warnings: [],
      approvalRequestId: persisted.approval.id,
      data: { expiresAt: persisted.approval.expiresAt.toISOString() },
    });
    if (persisted.created) {
      await emit(runId, {
        type: "action_started",
        actionId: persisted.action.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: `Checking approval for ${definition.title}.`,
      });
      await emit(runId, {
        type: "approval_required",
        actionId: persisted.action.id,
        approvalRequestId: persisted.approval.id,
        toolName: definition.name,
        target,
        expiresAt: persisted.approval.expiresAt.toISOString(),
        summary,
      });
    }

    return result;
  };

  const invokeInternal = async (
    name: string,
    rawInput: unknown,
    context: AgentControlInvocationContext,
    invocation: InvocationState,
  ): Promise<AgentControlToolResult> => {
    const definition = findAgentControlTool(name);
    const fallbackActionId = randomUUID();
    if (!definition) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Unknown Agent Control tool: ${name}`,
          retryable: false,
        },
      });
    }
    invocation.toolName = definition.name;
    invocation.runId = context.runId;
    if (!definition.audiences.includes(context.audience)) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "AUDIENCE_DENIED",
          message: `${name} is not available to ${context.audience}.`,
          retryable: false,
        },
      });
    }
    if (context.readonly && definition.risk !== "read") {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "READONLY_DENIED",
          message: `${name} cannot run through a read-only endpoint.`,
          retryable: false,
        },
      });
    }
    const missingScope = definition.requiredScopes.find((scope) => !context.scopes.has(scope));
    if (missingScope) {
      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "SCOPE_DENIED",
          message: `${name} requires scope ${missingScope}.`,
          retryable: false,
        },
      });
    }
    const parsedResult = ResultAsync.fromPromise(
      Promise.resolve().then(() => parseAgentControlToolInput(name, rawInput)),
      (error) => error,
    );
    const parsed = await parsedResult;
    if (parsed.isErr()) {
      const zodError = parsed.error instanceof z.ZodError ? parsed.error : null;
      const issue = zodError?.issues[0];

      return failureResult({
        actionId: fallbackActionId,
        error: {
          code: "INVALID_TOOL_INPUT",
          message:
            issue?.message ??
            (parsed.error instanceof Error ? parsed.error.message : "Invalid tool input"),
          retryable: true,
          ...(issue?.path.length ? { field: issue.path.join(".") } : {}),
        },
      });
    }
    const input = parsed.value;
    const threadId = await ensureThread(context);
    const runId = context.runId;
    const target = targetFrom(definition.name as AgentControlToolName, input);
    invocation.resources = target ? [target] : [];
    const redactedInput = redactAgentControlInput(definition, input);
    const callId = callIdFrom(input);
    const argumentDigest = digestAgentControlArguments(input);

    if (definition.risk === "draft" && definition.name !== "ordine.finish_canvas_edit") {
      const mutation = await serializeCanvasMutation(
        `${threadId}:${target?.id ?? "unknown-pipeline"}`,
        () =>
          canvas.applyMutation({
            toolName: definition.name as Parameters<typeof canvas.applyMutation>[0]["toolName"],
            input: input as Parameters<typeof canvas.applyMutation>[0]["input"],
            threadId,
            runId,
            risk: definition.risk,
            redactedInput,
            argumentDigest,
            onStarted: (actionId) => {
              invocation.actionId = actionId;

              return emit(runId, {
                type: "action_started",
                actionId,
                toolName: definition.name,
                risk: definition.risk,
                target,
                summary: definition.title,
              });
            },
          }),
      );
      if (mutation.isErr()) {
        if (await actionsDao.findById(mutation.error.actionId)) {
          await emit(runId, {
            type: "action_failed",
            actionId: mutation.error.actionId,
            toolName: definition.name,
            error: {
              retryable: mutation.error.retryable,
              code: mutation.error.code,
              message: mutation.error.message,
              ...(mutation.error.field ? { field: mutation.error.field } : {}),
              ...(mutation.error.nodeId ? { nodeId: mutation.error.nodeId } : {}),
              ...(mutation.error.portId ? { portId: mutation.error.portId } : {}),
            },
          });
        }

        return failureResult({
          actionId: mutation.error.actionId,
          error: mutation.error,
          resources: target ? [target] : [],
        });
      }
      if (!mutation.value.replayed) {
        await emit(runId, {
          type: "draft_applied",
          actionId: mutation.value.actionId,
          changeSetId: mutation.value.changeSetId,
          pipelineId: mutation.value.pipelineId,
          action: mutation.value.pipelineAction,
        });
        await emit(runId, {
          type: "action_succeeded",
          actionId: mutation.value.actionId,
          result: mutation.value.result,
        });
      }

      return mutation.value.result;
    }

    const existing = callId
      ? await actionsDao.findByIdempotency(threadId, definition.name, callId)
      : null;
    if (existing) invocation.actionId = existing.id;
    const mismatch = existing
      ? idempotencyMismatchResult(existing, argumentDigest, target ? [target] : [])
      : null;
    if (mismatch) return mismatch;
    if (existing && existing.status !== "approval_required") return replayResult(existing);

    const preflightResult = await executionPreflight(
      definition.name as AgentControlToolName,
      input,
    );
    if (preflightResult.isErr()) {
      const actionId = existing?.id ?? randomUUID();
      if (!existing) {
        const persisted = await actionsDao.createIdempotent({
          id: actionId,
          threadId,
          runId,
          changeSetId: null,
          toolName: definition.name,
          risk: definition.risk,
          status: "started",
          targetType: target?.type ?? null,
          targetId: target?.id ?? null,
          redactedInput,
          result: null,
          forwardAction: null,
          inverseActions: null,
          idempotencyKey: callId,
          argumentDigest,
          completedAt: null,
        });
        invocation.actionId = persisted.action.id;
        if (!persisted.created) {
          return (
            idempotencyMismatchResult(persisted.action, argumentDigest, target ? [target] : []) ??
            replayResult(persisted.action)
          );
        }
        await emit(runId, {
          type: "action_started",
          actionId: persisted.action.id,
          toolName: definition.name,
          risk: definition.risk,
          target,
          summary: definition.title,
        });
      }

      return persistFailure({
        actionId: invocation.actionId ?? actionId,
        toolName: definition.name,
        runId,
        error: preflightResult.error,
        resources: target ? [target] : [],
      });
    }
    const approvalReasons = [
      ...(definition.risk === "irreversible" ? [`${definition.title} is irreversible`] : []),
      ...(preflightResult.value?.requiresApproval ? preflightResult.value.reasons : []),
    ];
    if (existing?.status === "approval_required") {
      const approval = await approvalsDao.findByActionId(existing.id);
      const requestedApprovalId = approvalRequestIdFrom(input);
      if (!approval || requestedApprovalId !== approval.id) return replayResult(existing);
      if (approval.argumentDigest !== digestAgentControlArguments(input)) {
        return persistFailure({
          actionId: existing.id,
          toolName: definition.name,
          runId,
          error: {
            code: "APPROVAL_ARGUMENT_MISMATCH",
            message:
              "Approved arguments differ from this retry; submit a new callId for changed arguments.",
            retryable: false,
            field: "approvalRequestId",
          },
          resources: target ? [target] : [],
        });
      }
      const consumed = await repository.consumeApproval({
        approvalId: approval.id,
        actionId: existing.id,
        callId: callId!,
        argumentDigest: approval.argumentDigest,
        now: new Date(),
      });
      if (!consumed) {
        const state = await approvalsDao.findById(approval.id);

        return state?.status === "pending"
          ? replayResult(existing)
          : persistFailure({
              actionId: existing.id,
              toolName: definition.name,
              runId,
              error: {
                code: "APPROVAL_NOT_CONSUMABLE",
                message: `Approval ${approval.id} is ${state?.status ?? "missing"} or expired.`,
                retryable: state?.status === "expired",
                field: "approvalRequestId",
              },
              resources: target ? [target] : [],
            });
      }
      await emit(runId, {
        type: "action_started",
        actionId: existing.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: `${definition.title} approved for one execution.`,
      });
    } else if (approvalReasons.length > 0) {
      return requestApproval({
        actionId: randomUUID(),
        definition,
        input,
        threadId,
        runId,
        target,
        redactedInput,
        reasons: approvalReasons,
      });
    }

    const actionId = existing?.id ?? randomUUID();
    if (!existing) {
      const persisted = await actionsDao.createIdempotent({
        id: actionId,
        threadId,
        runId,
        changeSetId: null,
        toolName: definition.name,
        risk: definition.risk,
        status: "started",
        targetType: target?.type ?? null,
        targetId: target?.id ?? null,
        redactedInput,
        result: null,
        forwardAction: null,
        inverseActions: null,
        idempotencyKey: callId,
        argumentDigest,
        completedAt: null,
      });
      invocation.actionId = persisted.action.id;
      if (!persisted.created) {
        return (
          idempotencyMismatchResult(persisted.action, argumentDigest, target ? [target] : []) ??
          replayResult(persisted.action)
        );
      }
      await emit(runId, {
        type: "action_started",
        actionId: persisted.action.id,
        toolName: definition.name,
        risk: definition.risk,
        target,
        summary: definition.title,
      });
    }
    const persistedActionId = invocation.actionId ?? actionId;
    const domain = await executeDomainTool(
      definition.name as AgentControlToolName,
      input,
      threadId,
      persistedActionId,
    );
    if (domain.isErr()) {
      return persistFailure({
        actionId: persistedActionId,
        toolName: definition.name,
        runId,
        error: domain.error,
        resources: target ? [target] : [],
      });
    }
    const result = successResult(persistedActionId, domain.value);
    await actionsDao.update(persistedActionId, {
      status: "succeeded",
      result,
      completedAt: new Date(),
    });
    if (definition.name === "ordine.finish_canvas_edit") {
      const data = domain.value.data;
      await emit(runId, {
        type: "change_set_ready",
        changeSetId: String(data?.changeSetId),
        target: target!,
        baseVersion: Number(data?.baseVersion),
        actionCount: Number(data?.actionCount ?? 0),
        summary: domain.value.summary,
      });
    }
    await emit(runId, { type: "action_succeeded", actionId: persistedActionId, result });
    if ((definition.risk === "write" || definition.risk === "execute") && result.resources[0]) {
      const resource = result.resources.at(-1)!;
      await emit(runId, {
        type: "navigation_requested",
        pathname: navigationPath(resource),
        resource,
        focusId: resource.id,
      });
    }

    return result;
  };

  return {
    defaultThreadId(audience: AgentControlInvocationContext["audience"]): string {
      return `agent-control-${audience}-local-owner`;
    },

    invoke(name: string, input: unknown, context: AgentControlInvocationContext) {
      const invocation: InvocationState = {
        actionId: null,
        runId: context.runId,
        toolName: null,
        resources: [],
      };

      return ResultAsync.fromPromise(
        invokeInternal(name, input, context, invocation),
        unexpectedError,
      ).match(
        (result) => result,
        async (error) => {
          if (invocation.actionId && invocation.toolName) {
            const action = await actionsDao.findById(invocation.actionId);
            if (action?.status === "started") {
              return persistFailure({
                actionId: invocation.actionId,
                toolName: invocation.toolName,
                runId: invocation.runId,
                error,
                resources: invocation.resources,
              });
            }
          }

          return failureResult({
            actionId: invocation.actionId ?? randomUUID(),
            error,
            resources: invocation.resources,
          });
        },
      );
    },

    async getChangeSets(threadId: string) {
      return (await changeSetsDao.findManyByThreadId(threadId)).map(toPublicChangeSet);
    },

    async getActions(threadId: string) {
      return (await actionsDao.findManyByThreadId(threadId)).map(toPublicAction);
    },

    async getApprovals(threadId: string) {
      await approvalsDao.expirePending(new Date());

      return (await approvalsDao.findManyByThreadId(threadId)).map(toPublicApproval);
    },

    async approve(approvalId: string) {
      await approvalsDao.expirePending(new Date());

      const approval = await approvalsDao.approve(approvalId, new Date());

      return approval ? toPublicApproval(approval) : null;
    },

    async rejectApproval(approvalId: string) {
      const approval = await approvalsDao.reject(approvalId);
      if (!approval) return null;
      const error = {
        code: "APPROVAL_REJECTED",
        message: "The irreversible action was rejected; no domain data was changed.",
        retryable: false,
      } satisfies DomainError;
      await persistFailure({
        actionId: approval.actionId,
        toolName: approval.toolName,
        runId: approval.runId,
        error,
        resources:
          approval.targetType && approval.targetId
            ? [{ type: approval.targetType as AgentResourceRef["type"], id: approval.targetId }]
            : [],
      });

      return toPublicApproval(approval);
    },

    async applyChangeSet(changeSetId: string, expectedVersion: number) {
      const applied = await repository.applyChangeSet(changeSetId, expectedVersion);
      if (applied.type === "applied") {
        await emit(applied.changeSet.runId, {
          type: "change_set_committed",
          changeSetId,
          target: {
            type: applied.changeSet.targetType as AgentResourceRef["type"],
            id: applied.changeSet.targetId,
          },
          previousVersion: applied.previousVersion,
          newVersion: applied.newVersion,
        });
      }

      return applied.type === "applied"
        ? { ...applied, changeSet: toPublicChangeSet(applied.changeSet) }
        : applied;
    },

    async rejectChangeSet(
      changeSetId: string,
      reason: "rejected" | "cancelled" | "failed" = "rejected",
    ) {
      const rejected = await repository.rejectChangeSet(changeSetId);
      if (rejected) {
        await emit(rejected.runId, {
          type: "change_set_rolled_back",
          changeSetId,
          target: { type: rejected.targetType as AgentResourceRef["type"], id: rejected.targetId },
          reason,
        });
      }

      return rejected ? toPublicChangeSet(rejected) : null;
    },

    async revertChangeSet(
      sourceChangeSetId: string,
      expectedVersion: number,
      runId?: string | null,
    ) {
      const result = await repository.compensateChangeSet({
        sourceChangeSetId,
        expectedVersion,
        kind: "revert",
        id: randomUUID(),
        runId,
      });
      if (result.type === "applied") {
        await emit(result.changeSet.runId, {
          type: "change_set_rolled_back",
          changeSetId: result.changeSet.id,
          target: { type: "pipeline", id: result.changeSet.targetId },
          reason: "reverted",
        });
      }

      return result.type === "applied"
        ? { ...result, changeSet: toPublicChangeSet(result.changeSet) }
        : result;
    },

    async redoChangeSet(sourceChangeSetId: string, expectedVersion: number, runId?: string | null) {
      const result = await repository.compensateChangeSet({
        sourceChangeSetId,
        expectedVersion,
        kind: "redo",
        id: randomUUID(),
        runId,
      });
      if (result.type === "applied") {
        await emit(result.changeSet.runId, {
          type: "change_set_committed",
          changeSetId: result.changeSet.id,
          target: { type: "pipeline", id: result.changeSet.targetId },
          previousVersion: result.previousVersion,
          newVersion: result.newVersion,
        });
      }

      return result.type === "applied"
        ? { ...result, changeSet: toPublicChangeSet(result.changeSet) }
        : result;
    },

    async rollbackDraftsForRun(runId: string, reason: "cancelled" | "failed") {
      const actions = await actionsDao.findManyByRunId(runId);
      const changeSetIds = [
        ...new Set(
          actions
            .filter((action) => action.runId === runId)
            .map((action) => action.changeSetId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const rolledBack = [];
      for (const changeSetId of changeSetIds) {
        const rejected = await repository.rejectChangeSet(changeSetId);
        if (rejected) {
          rolledBack.push(rejected);
          await emit(rejected.runId, {
            type: "change_set_rolled_back",
            changeSetId,
            target: {
              type: rejected.targetType as AgentResourceRef["type"],
              id: rejected.targetId,
            },
            reason,
          });
        }
      }

      return rolledBack;
    },

    async getCanvasRunCompletion(runId: string) {
      const actions = await actionsDao.findManyByRunId(runId);
      const changeSetIds = [
        ...new Set(
          actions
            .filter(
              (action) =>
                action.risk === "draft" &&
                action.toolName !== "ordine.finish_canvas_edit" &&
                action.status === "succeeded",
            )
            .map((action) => action.changeSetId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const changeSets = (
        await Promise.all(changeSetIds.map((changeSetId) => changeSetsDao.findById(changeSetId)))
      ).filter((changeSet): changeSet is NonNullable<typeof changeSet> => Boolean(changeSet));
      const finishedIds = new Set(
        actions
          .filter(
            (action) =>
              action.toolName === "ordine.finish_canvas_edit" && action.status === "succeeded",
          )
          .map((action) => {
            const parsed = AgentControlToolResultSchema.safeParse(action.result);

            return parsed.success && typeof parsed.data.data?.changeSetId === "string"
              ? parsed.data.data.changeSetId
              : null;
          })
          .filter((id): id is string => Boolean(id)),
      );
      const complete = changeSets.every(
        (changeSet) =>
          finishedIds.has(changeSet.id) ||
          ["ready", "committed", "reverted"].includes(changeSet.status),
      );

      return {
        hasCanvasMutations: changeSetIds.length > 0,
        complete,
        changeSetIds,
      };
    },
  };
};
