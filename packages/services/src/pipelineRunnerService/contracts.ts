import type {
  PipelineEngineDeps,
  DecisionResult,
  OperationRuntimeContext,
  RunPromptOptions,
  RunSkillOptions as EngineRunSkillOptions,
} from "@repo/pipeline-engine";
import type { ResultAsync, Result } from "neverthrow";

import type {
  AgentRuntime,
  JobStatus,
  SshConnection,
  NodeRunStatus,
  OutputItem,
  UserActionPayload,
} from "@repo/schemas";

import type {
  createAgentsDao,
  createOperationsDao,
  createPipelinesDao,
  createJobsDao,
  createJobTracesDao,
  createSkillsDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createSettingsDao,
  createPipelineRunsDao,
  createAgentRuntimesDao,
  createConnectorsDao,
  DbConnection,
  JobsDao,
  AgentRawExportsDao,
} from "@repo/models";

import type { McpConnectorInjectionProvider, AgentRunController } from "@repo/agent-engine";

import type {
  PipelineRunnerServiceOptions,
  PipelineNotFoundError,
  AgentRuntimeNotFoundError,
  JobNotFoundError,
  InvalidJobStatusError,
} from "./pipelineRunner.service";

export interface PipelineRunnerServiceBindings {
  PipelineNotFoundError: typeof PipelineNotFoundError;
  AgentRuntimeNotFoundError: typeof AgentRuntimeNotFoundError;
  JobNotFoundError: typeof JobNotFoundError;
  InvalidJobStatusError: typeof InvalidJobStatusError;
  db: DbConnection;
  options: PipelineRunnerServiceOptions;
  agentsDao: ReturnType<typeof createAgentsDao>;
  operationsDao: ReturnType<typeof createOperationsDao>;
  pipelinesDao: ReturnType<typeof createPipelinesDao>;
  jobsDao: ReturnType<typeof createJobsDao>;
  pipelineRunsDao: ReturnType<typeof createPipelineRunsDao>;
  jobTracesDao: ReturnType<typeof createJobTracesDao>;
  skillsDao: ReturnType<typeof createSkillsDao>;
  agentRawExportsDao: ReturnType<typeof createAgentRawExportsDao>;
  agentSpansDao: ReturnType<typeof createAgentSpansDao>;
  settingsDao: ReturnType<typeof createSettingsDao>;
  agentRuntimesDao: ReturnType<typeof createAgentRuntimesDao>;
  connectorsDao: ReturnType<typeof createConnectorsDao>;
  guardJobStatus: (
    action: string,
    jobId: string,
    allowed: readonly JobStatus[],
  ) => Promise<Result<void, JobNotFoundError | InvalidJobStatusError>>;
  persistStatus: (
    jobId: string,
    from: readonly JobStatus[],
    status: JobStatus,
    extra?: { finishedAt?: Date },
  ) => ResultAsync<unknown, Error>;
  buildDepsForJob: (argument0: {
    jobId: string;
    apiKey?: string;
    model?: string;
    reasoningEffort?: string;
    speed?: string;
    firstOutputTimeoutMs?: number;
    runtimeConfigId?: string;
    executablePath?: string;
    defaultAgent?: AgentRuntime;
    overrideOperationRoute?: boolean;
    ssh?: SshConnection;
    getMcpConnectorInjection?: McpConnectorInjectionProvider;
    signal?: AbortSignal;
  }) => PipelineEngineDeps;
  buildMcpConnectorInjectionProvider: (
    preferredSource: AgentRuntime,
  ) => (
    selectedToolNames: readonly string[],
    operationAgent?: AgentRuntime,
  ) => ReturnType<McpConnectorInjectionProvider>;
}

export type ResumeWaiter = () => void;
export type DecisionWaiter = {
  resolve: (result: DecisionResult) => void;
  reject: (error: Error) => void;
};
export type RunControlState = {
  pauseRequested: boolean;
  cancelRequested: boolean;
  abortController: AbortController;
  waiters: ResumeWaiter[];
  decisionWaiters: Map<string, DecisionWaiter>;
};
export interface RunControlAssemblyBindings {
  states: Map<string, RunControlState>;
  getState: (jobId: string) => RunControlState;
  releaseWaiters: (state: RunControlState) => void;
  rejectDecisionWaiters: (state: RunControlState, jobId: string) => void;
}

export interface RunPipelineAssemblyBindings {
  aggregateUsageTotalsSafely: (argument0: {
    agentRawExportsDao: AgentRawExportsDao;
    jobId: string;
  }) => Promise<{ totalTokens: number } | undefined>;
  createNodeStatusWriter: (argument0: {
    jobsDao: JobsDao;
    jobId: string;
  }) => (nodeId: string, status: NodeRunStatus) => Promise<void>;
  recordUsageOnFinalizedJobSafely: (argument0: {
    jobsDao: JobsDao;
    jobId: string;
    usageTotals?: { totalTokens: number };
  }) => Promise<void>;
  failJobSafely: (argument0: {
    jobsDao: JobsDao;
    jobId: string;
    message: string;
    usageTotals?: { totalTokens: number };
  }) => Promise<void>;
}

export type PromptExecutorOptions = RunPromptOptions & {
  ssh?: SshConnection;
  getMcpConnectorInjection?: McpConnectorInjectionProvider;
  signal?: AbortSignal;
  agentRunController?: AgentRunController;
};
export type UserActionRequest = { line: string; payload: UserActionPayload };
export interface PromptExecutorAssemblyBindings {
  PROMPT_AGENT_ID: "prompt-executor";
  USER_ACTION_SECTION: string;
  parseUserActionRequest: (rawText: string) => Result<UserActionRequest | null, Error>;
  DOWNSTREAM_DATA_CONTRACT_SECTION: string;
  buildRuntimeContextSection: (runtimeContext?: OperationRuntimeContext) => string;
  buildSystemPrompt: (argument0: {
    prompt: string;
    runtimeContext?: OperationRuntimeContext;
  }) => string;
  buildOutputItemsSection: (outputItems?: readonly OutputItem[], outputDir?: string) => string;
  run: (argument0: PromptExecutorOptions) => ResultAsync<string, Error>;
}

import type { CheckOutput, FixOutput } from "@repo/agent";

import type { SkillExecutionError, DEFAULT_SKILL_SYSTEM_PROMPT } from "./helpers/skillExecutor";
export type RunSkillExecutorOptions = EngineRunSkillOptions & {
  jobId?: string;
  ssh?: SshConnection;
  getMcpConnectorInjection?: McpConnectorInjectionProvider;
  signal?: AbortSignal;
  agentRunController?: AgentRunController;
};
export interface SkillExecutorAssemblyBindings {
  SkillExecutionError: typeof SkillExecutionError;
  DEFAULT_SKILL_SYSTEM_PROMPT: typeof DEFAULT_SKILL_SYSTEM_PROMPT;
  CHECK_OUTPUT_EXAMPLE: CheckOutput;
  FIX_OUTPUT_EXAMPLE: FixOutput;
  buildSkillUserPrompt: (argument0: {
    skillId: string;
    skillDescription: string;
    inputContent: string;
    inputPath: string;
    outputItems?: readonly OutputItem[];
    outputDir?: string;
    runtimeContext?: OperationRuntimeContext;
  }) => string;
  validateSkillOutput: (argument0: { raw: string }) => string;
  run: (argument0: RunSkillExecutorOptions) => ResultAsync<string, SkillExecutionError>;
}

export interface StructuredOutputAssemblyBindings {
  tryParseJson: (argument0: { text: string }) => unknown | undefined;
  extract: (argument0: { rawText: string }) => string;
  toMarkdown: (argument0: { content: string }) => string;
}
