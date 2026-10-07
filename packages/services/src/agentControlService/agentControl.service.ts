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
import type {
  AgentControlEvent,
  AgentRuntime,
  AgentRunStatus,
  ExecutionPortValues,
} from "@repo/schemas";

import { createCanvasControl } from "./helpers/canvasControl";

import { createExecutionPreflight } from "./helpers/executionPreflight";

import { createResourceControl } from "./helpers/resourceControl";

export type AgentControlExecutionPorts = {
  submissionMode?: "prepared-run";
  runPipeline: (input: {
    pipelineId: string;
    inputs?: ExecutionPortValues;
    requestId?: string;
  }) => Promise<ExecutionResult>;
  runOperation: (input: {
    operationId: string;
    inputs?: ExecutionPortValues;
    requestId?: string;
  }) => Promise<ExecutionResult>;
  runRoutine: (routineId: string, requestId?: string) => Promise<ExecutionResult>;
  controlJob: (jobId: string, action: "pause" | "resume" | "cancel") => Promise<ExecutionResult>;
  getJobTrace?: (jobId: string, afterSequence: number) => Promise<ExecutionResult>;
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
import type { ExecutionResult, AgentControlServiceBindings } from "./contracts";
import { digestAgentControlArguments } from "./helpers/digestAgentControlArguments";
import {
  createSerializeCanvasMutationHelper,
  createEmitHelper,
  createEnsureThreadHelper,
  createPersistFailureHelper,
  createCheckExecutionPreflightHelper,
  createExecuteDomainToolHelper,
  createRequestApprovalHelper,
  createInvokeInternalHelper,
} from "./helpers";

import {
  createDefaultThreadIdMethod,
  createInvokeMethod,
  createGetChangeSetsMethod,
  createGetActionsMethod,
  createGetApprovalsMethod,
  createApproveMethod,
  createRejectApprovalMethod,
  createApplyChangeSetMethod,
  createRejectChangeSetMethod,
  createRevertChangeSetMethod,
  createRedoChangeSetMethod,
  createRollbackDraftsForRunMethod,
  createGetCanvasRunCompletionMethod,
} from "./methods";

export const createAgentControlService = (
  db: DbConnection,
  options: AgentControlServiceOptions = {},
) => {
  const serviceBindings: AgentControlServiceBindings = {
    get db() {
      return db;
    },
    get options() {
      return options;
    },
    get actionsDao() {
      return actionsDao;
    },
    get approvalsDao() {
      return approvalsDao;
    },
    get changeSetsDao() {
      return changeSetsDao;
    },
    get threadsDao() {
      return threadsDao;
    },
    get jobsDao() {
      return jobsDao;
    },
    get tracesDao() {
      return tracesDao;
    },
    get pipelinesDao() {
      return pipelinesDao;
    },
    get repository() {
      return repository;
    },
    get resources() {
      return resources;
    },
    get canvas() {
      return canvas;
    },
    get preflight() {
      return preflight;
    },
    get canvasMutationQueues() {
      return canvasMutationQueues;
    },
    get serializeCanvasMutation() {
      return serializeCanvasMutation;
    },
    get emit() {
      return emit;
    },
    get ensureThread() {
      return ensureThread;
    },
    get persistFailure() {
      return persistFailure;
    },
    get executionPreflight() {
      return executionPreflight;
    },
    get executeDomainTool() {
      return executeDomainTool;
    },
    get requestApproval() {
      return requestApproval;
    },
    get invokeInternal() {
      return invokeInternal;
    },
  };

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

  const serializeCanvasMutation = createSerializeCanvasMutationHelper(serviceBindings);

  const emit = createEmitHelper(serviceBindings);

  const ensureThread = createEnsureThreadHelper(serviceBindings);

  const persistFailure = createPersistFailureHelper(serviceBindings);

  const executionPreflight = createCheckExecutionPreflightHelper(serviceBindings);

  const executeDomainTool = createExecuteDomainToolHelper(serviceBindings);

  const requestApproval = createRequestApprovalHelper(serviceBindings);

  const invokeInternal = createInvokeInternalHelper(serviceBindings);

  return {
    defaultThreadId: createDefaultThreadIdMethod(serviceBindings),

    invoke: createInvokeMethod(serviceBindings),

    getChangeSets: createGetChangeSetsMethod(serviceBindings),

    getActions: createGetActionsMethod(serviceBindings),

    getApprovals: createGetApprovalsMethod(serviceBindings),

    approve: createApproveMethod(serviceBindings),

    rejectApproval: createRejectApprovalMethod(serviceBindings),

    applyChangeSet: createApplyChangeSetMethod(serviceBindings),

    rejectChangeSet: createRejectChangeSetMethod(serviceBindings),

    revertChangeSet: createRevertChangeSetMethod(serviceBindings),

    redoChangeSet: createRedoChangeSetMethod(serviceBindings),

    rollbackDraftsForRun: createRollbackDraftsForRunMethod(serviceBindings),

    getCanvasRunCompletion: createGetCanvasRunCompletionMethod(serviceBindings),
  };
};
