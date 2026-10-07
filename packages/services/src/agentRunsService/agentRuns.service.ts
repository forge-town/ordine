import { readFile } from "node:fs/promises";

import { agentEngine, type AgentRunOptions } from "@repo/agent-engine";
import { probeRuntimeCapabilities, scanRuntimes } from "@repo/agent";

import {
  createAgentRunEventsDao,
  createAgentRunsDao,
  createAgentRuntimesDao,
  type DbConnection,
} from "@repo/models";
import type { AgentRun, AgentRuntime } from "@repo/schemas";

export type AgentRunTransientOptions = Pick<
  AgentRunOptions,
  | "apiKey"
  | "attachments"
  | "connectorInjection"
  | "getMcpConnectorInjection"
  | "githubToken"
  | "environment"
>;

export type AgentRunTransientLease = AgentRunTransientOptions & {
  dispose?: () => Promise<void> | void;
};

export type AgentRunTransientFactory = (
  runId: string,
) => Promise<AgentRunTransientLease> | AgentRunTransientLease;

export class AgentControlModeUnsupportedError extends Error {
  readonly code = "CONTROL_MODE_UNSUPPORTED";

  constructor(readonly runtime: AgentRuntime) {
    super(`${runtime} is not verified for MCP-only Agent Control mode`);
    this.name = "AgentControlModeUnsupportedError";
  }
}
import {
  FIRST_OUTPUT_TIMEOUT_MS,
  INACTIVITY_TIMEOUT_MS,
  EXECUTOR_LEASE_MS,
  EXECUTOR_HEARTBEAT_MS,
  type EventListener,
  type ActiveRun,
  type AgentRunsServiceDependencies,
  type AgentRunsServiceBindings,
} from "./contracts";

import {
  createBroadcastHelper,
  createSerializeRunPersistenceHelper,
  createPersistEventHelper,
  createResolveRuntimeConfigHelper,
  createResolveRuntimeHelper,
  createGetRunRecordHelper,
  createEnsureActivityProjectionHelper,
  createGetPublicRunHelper,
  createFinishRunHelper,
  createExecuteRunHelper,
  createInitializeRunHelper,
} from "./helpers";

import {
  createStartMethod,
  createCloseAdmissionMethod,
  createStopOwnedRunsMethod,
  createExecuteMethod,
  createGetByIdMethod,
  createGetLatestByOwnerMethod,
  createWaitMethod,
  createGetEventsMethod,
  createAppendControlEventMethod,
  createSubscribeMethod,
  createCancelMethod,
  createRecordActivityTelemetryMethod,
  createRecoverInterruptedRunsMethod,
  createDeleteExpiredMethod,
} from "./methods";

export const createAgentRunsService = (
  db: DbConnection,
  dependencies: AgentRunsServiceDependencies = {},
) => {
  const serviceBindings: AgentRunsServiceBindings = {
    get db() {
      return db;
    },
    get dependencies() {
      return dependencies;
    },
    get runsDao() {
      return runsDao;
    },
    get eventsDao() {
      return eventsDao;
    },
    get runtimesDao() {
      return runtimesDao;
    },
    get runAgent() {
      return runAgent;
    },
    get scan() {
      return scan;
    },
    get probeCapabilities() {
      return probeCapabilities;
    },
    get readExecutable() {
      return readExecutable;
    },
    get firstOutputTimeoutMs() {
      return firstOutputTimeoutMs;
    },
    get inactivityTimeoutMs() {
      return inactivityTimeoutMs;
    },
    get executorLeaseMs() {
      return executorLeaseMs;
    },
    get executorHeartbeatMs() {
      return executorHeartbeatMs;
    },
    get executorId() {
      return executorId;
    },
    get activeRuns() {
      return activeRuns;
    },
    get admission() {
      return admission;
    },
    get startingRuns() {
      return startingRuns;
    },
    get AdmissionClosedError() {
      return AdmissionClosedError;
    },
    get AgentControlModeUnsupportedError() {
      return AgentControlModeUnsupportedError;
    },
    get executions() {
      return executions;
    },
    get listeners() {
      return listeners;
    },
    get eventPersistenceQueues() {
      return eventPersistenceQueues;
    },
    get broadcast() {
      return broadcast;
    },
    get serializeRunPersistence() {
      return serializeRunPersistence;
    },
    get persistEvent() {
      return persistEvent;
    },
    get resolveRuntimeConfig() {
      return resolveRuntimeConfig;
    },
    get resolveRuntime() {
      return resolveRuntime;
    },
    get getRunRecord() {
      return getRunRecord;
    },
    get ensureActivityProjection() {
      return ensureActivityProjection;
    },
    get getPublicRun() {
      return getPublicRun;
    },
    get finishRun() {
      return finishRun;
    },
    get executeRun() {
      return executeRun;
    },
    get initializeRun() {
      return initializeRun;
    },
    get startInternal() {
      return startInternal;
    },
    get closeAdmission() {
      return closeAdmission;
    },
  };

  const runsDao = createAgentRunsDao(db);
  const eventsDao = createAgentRunEventsDao(db);
  const runtimesDao = createAgentRuntimesDao(db);
  const runAgent = dependencies.runAgent ?? agentEngine.runDirect;
  const scan = dependencies.scan ?? scanRuntimes;
  const probeCapabilities = dependencies.probeCapabilities ?? probeRuntimeCapabilities;
  const readExecutable = dependencies.readExecutable ?? readFile;
  const firstOutputTimeoutMs = dependencies.firstOutputTimeoutMs ?? FIRST_OUTPUT_TIMEOUT_MS;
  const inactivityTimeoutMs = dependencies.inactivityTimeoutMs ?? INACTIVITY_TIMEOUT_MS;
  const executorLeaseMs = dependencies.executorLeaseMs ?? EXECUTOR_LEASE_MS;
  const executorHeartbeatMs = dependencies.executorHeartbeatMs ?? EXECUTOR_HEARTBEAT_MS;
  const executorId = crypto.randomUUID();
  const activeRuns = new Map<string, ActiveRun>();
  const admission = { open: true };
  const startingRuns = new Set<Promise<{ runId: string }>>();
  class AdmissionClosedError extends Error {
    constructor() {
      super("Authoring Agent service is shutting down.");
    }
  }
  const executions = new Map<string, Promise<AgentRun>>();
  const listeners = new Map<string, Set<EventListener>>();
  const eventPersistenceQueues = new Map<string, Promise<unknown>>();

  const broadcast = createBroadcastHelper(serviceBindings);

  const serializeRunPersistence = createSerializeRunPersistenceHelper(serviceBindings);

  const persistEvent = createPersistEventHelper(serviceBindings);

  const resolveRuntimeConfig = createResolveRuntimeConfigHelper(serviceBindings);

  const resolveRuntime = createResolveRuntimeHelper(serviceBindings);

  const getRunRecord = createGetRunRecordHelper(serviceBindings);

  const ensureActivityProjection = createEnsureActivityProjectionHelper(serviceBindings);

  const getPublicRun = createGetPublicRunHelper(serviceBindings);

  const finishRun = createFinishRunHelper(serviceBindings);

  const executeRun = createExecuteRunHelper(serviceBindings);

  const initializeRun = createInitializeRunHelper(serviceBindings);

  const startInternal = createStartMethod(serviceBindings);
  const closeAdmission = createCloseAdmissionMethod(serviceBindings);

  return {
    start: startInternal,
    closeAdmission,
    stopOwnedRuns: createStopOwnedRunsMethod(serviceBindings),

    execute: createExecuteMethod(serviceBindings),

    getById: createGetByIdMethod(serviceBindings),

    getLatestByOwner: createGetLatestByOwnerMethod(serviceBindings),

    wait: createWaitMethod(serviceBindings),

    getEvents: createGetEventsMethod(serviceBindings),

    appendControlEvent: createAppendControlEventMethod(serviceBindings),

    subscribe: createSubscribeMethod(serviceBindings),

    cancel: createCancelMethod(serviceBindings),

    recordActivityTelemetry: createRecordActivityTelemetryMethod(serviceBindings),

    recoverInterruptedRuns: createRecoverInterruptedRunsMethod(serviceBindings),

    deleteExpired: createDeleteExpiredMethod(serviceBindings),
  };
};
