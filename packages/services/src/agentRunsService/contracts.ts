import type { readFile } from "node:fs/promises";

import type { agentEngine } from "@repo/agent-engine";
import type { probeRuntimeCapabilities, scanRuntimes } from "@repo/agent";
import type { agentRunsTable, AgentRunRecord } from "@repo/db-schema";
import type {
  createAgentRunEventsDao,
  createAgentRunsDao,
  createAgentRuntimesDao,
  DbConnection,
} from "@repo/models";
import type {
  AgentRun,
  AgentRunEvent,
  AgentRunEventEnvelope,
  AgentRunRequest,
  ParsedAgentRunRequest,
  AgentRunStatus,
  AgentRunUsage,
  AgentRuntime,
  AgentRunActivityMetrics,
  RuntimeCapabilities,
} from "@repo/schemas";

import type {
  AgentRunTransientOptions,
  AgentRunTransientFactory,
  AgentControlModeUnsupportedError,
} from "./agentRuns.service";
export const SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code", "codex", "opencode"]);
export const CONTROL_MODE_SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code", "codex"]);
export const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const FIRST_OUTPUT_TIMEOUT_MS = 45_000;
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
export const EXECUTOR_LEASE_MS = 15_000;
export const EXECUTOR_HEARTBEAT_MS = 2000;
export const SESSION_NOT_FOUND =
  /(?:session|thread|rollout).{0,80}(?:not found|does not exist|missing|unknown|invalid)|no (?:session|thread|rollout)/i;
export type RuntimeConfig = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAgentRuntimesDao>["findById"]>>
>;
export type EventListener = (event: AgentRunEventEnvelope) => Promise<void> | void;
export type AbortReason = "user_cancel" | "first_output_timeout" | "inactivity_timeout";
export type TerminalAgentRunStatus = Extract<
  AgentRunStatus,
  "completed" | "failed" | "cancelled" | "timed_out"
>;
export type AgentRunPatch = Partial<Omit<typeof agentRunsTable.$inferInsert, "id">>;
export type ActivityMetricsDelta = Partial<Record<keyof AgentRunActivityMetrics, number>>;
export type ActiveRun = {
  controller: AbortController;
  abortReason: AbortReason | null;
  dispose?: () => Promise<void> | void;
  heartbeatTimer?: ReturnType<typeof setInterval>;
};
export type ResolvedRuntime = {
  path: string;
  version: string | null;
  fingerprint: string;
  resolutionWarning: string | null;
  supportsPartialMessages: boolean;
  supportsPermissionBypass: boolean;
  supportsReasoningEffort: boolean;
  supportsVariant: boolean;
  supportsAutoPermissions: boolean;
  supportsResume: boolean;
  runtimeCapabilities: RuntimeCapabilities;
};
export type AgentRunsServiceDependencies = {
  runAgent?: typeof agentEngine.run;
  scan?: typeof scanRuntimes;
  probeCapabilities?: typeof probeRuntimeCapabilities;
  readExecutable?: typeof readFile;
  firstOutputTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  executorLeaseMs?: number;
  executorHeartbeatMs?: number;
};
export type RuntimeExecutableResolutionInput = {
  runtime: AgentRuntime;
  configuredPath?: string;
  configuredVersion?: string;
  detectedPath?: string;
  detectedVersion?: string;
  readExecutable: (path: string) => Promise<Uint8Array>;
  probeCapabilities: typeof probeRuntimeCapabilities;
};
export interface AgentRunsServiceBindings {
  db: DbConnection;
  dependencies: AgentRunsServiceDependencies;
  runsDao: ReturnType<typeof createAgentRunsDao>;
  eventsDao: ReturnType<typeof createAgentRunEventsDao>;
  runtimesDao: ReturnType<typeof createAgentRuntimesDao>;
  runAgent: typeof agentEngine.runDirect;
  scan: typeof scanRuntimes;
  probeCapabilities: typeof probeRuntimeCapabilities;
  readExecutable: typeof readFile;
  firstOutputTimeoutMs: number;
  inactivityTimeoutMs: typeof INACTIVITY_TIMEOUT_MS;
  executorLeaseMs: number;
  executorHeartbeatMs: number;
  executorId: `${string}-${string}-${string}-${string}-${string}`;
  activeRuns: Map<string, ActiveRun>;
  admission: { open: boolean };
  startingRuns: Set<Promise<{ runId: string }>>;
  AdmissionClosedError: new () => Error;
  AgentControlModeUnsupportedError: typeof AgentControlModeUnsupportedError;
  executions: Map<string, Promise<AgentRun>>;
  listeners: Map<string, Set<EventListener>>;
  eventPersistenceQueues: Map<string, Promise<unknown>>;
  broadcast: (envelope: AgentRunEventEnvelope) => Promise<void>;
  serializeRunPersistence: <T>(runId: string, operation: () => Promise<T>) => Promise<T>;
  persistEvent: (
    runId: string,
    event: AgentRunEvent,
    runPatch?: AgentRunPatch,
    activityMetricsDelta?: ActivityMetricsDelta,
  ) => Promise<AgentRunEventEnvelope>;
  resolveRuntimeConfig: (runtimeConfigId: string) => Promise<RuntimeConfig>;
  resolveRuntime: (config: RuntimeConfig) => Promise<ResolvedRuntime>;
  getRunRecord: (runId: string) => Promise<AgentRunRecord>;
  ensureActivityProjection: (record: AgentRunRecord) => Promise<AgentRunRecord>;
  getPublicRun: (record: AgentRunRecord) => Promise<AgentRun>;
  finishRun: ({
    runId,
    runtime,
    status,
    resultText,
    nativeSessionId,
    usage,
    errorCode,
    errorMessage,
  }: {
    runId: string;
    runtime: AgentRuntime;
    status: TerminalAgentRunStatus;
    resultText: string;
    nativeSessionId: string | null;
    usage: AgentRunUsage | null;
    errorCode: string | null;
    errorMessage: string | null;
  }) => Promise<AgentRun>;
  executeRun: (
    runId: string,
    request: ParsedAgentRunRequest,
    runtimeConfig: RuntimeConfig,
    active: ActiveRun,
    transient: AgentRunTransientOptions,
  ) => Promise<AgentRun>;
  initializeRun: (
    input: AgentRunRequest,
    transientSource?: AgentRunTransientOptions | AgentRunTransientFactory,
  ) => Promise<{ runId: string }>;
  startInternal: (
    input: AgentRunRequest,
    transientSource?: AgentRunTransientOptions | AgentRunTransientFactory,
  ) => Promise<{ runId: string }>;
  closeAdmission: () => void;
}
