import type { ExecutionJobRecord } from "@repo/db-schema";
import type { Result, ResultAsync } from "neverthrow";
import type { ExecutionJobRepository, ExecutionLease, ExecutionRepository } from "@repo/models";

import type {
  ExecutionPrincipal,
  ExecutionScope,
  OperationRevision,
  PipelineDefinition,
  ExecutionError,
  ExecutionPortValues,
} from "@repo/schemas";
import type { createExecutionArtifactStore } from "../executionArtifacts";
import type { ExecutionPreparationService } from "./helpers/preparation";

export type ArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
export interface ExecutionApiServiceBindings {
  deps: {
    repository: ExecutionRepository;
    jobs: ExecutionJobRepository;
    artifactStore: ArtifactStore;
    preparation: ExecutionPreparationService;
  };
  scoped: <T>(
    principal: ExecutionPrincipal,
    scope: ExecutionScope,
    action: (identity: ExecutionPrincipal) => Promise<T>,
  ) => ResultAsync<
    T,
    {
      code: string;
      message: string;
      retryable: boolean;
      stage:
        | "authentication"
        | "validation"
        | "preparation"
        | "approval"
        | "execution"
        | "artifact";
      requestId?: string | undefined;
      jobId?: string | undefined;
      nodeId?: string | undefined;
      portId?: string | undefined;
      field?: string | undefined;
    }
  >;
  requireJob: (identity: ExecutionPrincipal, id: string) => Promise<ExecutionJobRecord>;
}

import type { fingerprintExecutable } from "./helpers/fingerprintExecutable";
import type { inspectCodexCredentialRef } from "../executionPrompt/codexHome";

export type PreparationArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
export type PreparationDependencies = {
  repository: Pick<
    ExecutionRepository,
    | "getOperationRevision"
    | "saveOperation"
    | "savePipeline"
    | "getPipeline"
    | "replayRunRequest"
    | "getWorkspaceSettings"
    | "listRuntimeConfigs"
    | "submitRun"
  >;
  artifactStore: Pick<PreparationArtifactStore, "getInputSnapshot">;
  scriptExecutables: Partial<Record<"javascript" | "python" | "bash", string>>;
  fingerprintExecutable?: typeof fingerprintExecutable;
  approvalTtlMs?: number;
  isAccepting?: () => boolean;
  inspectCodexCredentialRef?: typeof inspectCodexCredentialRef;
};
export interface ExecutionPreparationServiceBindings {
  deps: PreparationDependencies;
  repository: PreparationDependencies["repository"];
  fingerprint: typeof fingerprintExecutable;
  pinnedOperations: (
    workspaceId: string,
    graph: PipelineDefinition["graph"],
  ) => Promise<OperationRevision[]>;
}

import type { createExecutionProcessLimiter } from "./helpers/processLimiter";

import type { createExecutionActors, ExecutionActorContext } from "../executionActors";

export type JobRunnerArtifactStore = ReturnType<
  Awaited<ReturnType<typeof createExecutionArtifactStore>>["_unsafeUnwrap"]
>;
export type JobRunnerDependencies = {
  requests: Pick<ExecutionRepository, "getPrepared" | "getJob" | "getOperationRevision">;
  jobs: ExecutionJobRepository;
  artifactStore: JobRunnerArtifactStore;
  executePrompt?: (
    context: ExecutionActorContext,
  ) => Promise<Result<ExecutionPortValues, ExecutionError>>;
  leaseMs?: number;
  heartbeatMs?: number;
  maxNodeConcurrency?: number;
  processLimits?: Parameters<typeof createExecutionProcessLimiter>[0];
};
export interface ExecutionJobRunnerBindings {
  deps: JobRunnerDependencies;
  processes: ReturnType<typeof createExecutionProcessLimiter>;
  leaseMs: number;
  heartbeatMs: number;
  actors: ReturnType<typeof createExecutionActors>;
}

import type { ExecutionJobRunner } from "./helpers/jobRunner";

export interface ExecutionDispatcherBindings {
  deps: {
    principal: ExecutionPrincipal;
    instanceId: string;
    jobs: ExecutionJobRepository;
    requests: Pick<ExecutionRepository, "expirePendingApprovals">;
    runner: ExecutionJobRunner;
    maxJobs?: number;
    leaseMs?: number;
    pollMs?: number;
  };
  maxJobs: number;
  leaseMs: number;
  pollMs: number;
  active: Map<string, { controller: AbortController; task: Promise<void> }>;
  state: {
    accepting: boolean;
    started: boolean;
    tick?: Promise<void>;
    timer?: ReturnType<typeof setInterval>;
    lastError?: ExecutionError;
  };
  poll: () => void;
}

export type ProcessLimiterWaiter = {
  key: string;
  signal: AbortSignal;
  resolve: (result: Result<() => void, ExecutionError>) => void;
  cancel: () => void;
};
export interface ExecutionProcessLimiterBindings {
  options: { maxProcesses?: number; maxPerRuntime?: number; maxQueued?: number };
  maxProcesses: number;
  maxPerRuntime: number;
  maxQueued: number;
  state: { active: number };
  counts: Map<string, number>;
  queue: ProcessLimiterWaiter[];
  pump: () => void;
}

export interface OwnedJobExecutionBindings {
  state: {
    job: ExecutionJobRecord;
    done: boolean;
    heartbeat?: PromiseLike<void>;
    error?: ExecutionError;
    uncertain: boolean;
    stop?: PromiseLike<void>;
    leaseDeadline: number;
  };
  controller: AbortController;
  lease: ExecutionLease;
  observe: (job: ExecutionJobRecord) => void;
  refresh: () => Promise<ExecutionJobRecord>;
  activeAttempts: Set<string>;
  checkpoints: Set<string>;
  convergeWaiting: () => Promise<void>;
  principal: ExecutionPrincipal;
  abortWith: (error: ExecutionError) => void;
  loseLease: () => void;
}
