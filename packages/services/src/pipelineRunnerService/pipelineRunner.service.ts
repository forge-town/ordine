import { initObs, initSpanRecorder } from "@repo/obs";

import {
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
  type DbConnection,
} from "@repo/models";

import type { AgentRunController } from "@repo/agent-engine";

import type { JobLeaseTimingOptions } from "../jobLease";

export interface PipelineRunnerServiceOptions {
  encryptionSecret?: string;
  env?: Readonly<Record<string, string | undefined>>;
  agentRunController?: AgentRunController;
  jobLease?: JobLeaseTimingOptions;
}

export class PipelineNotFoundError extends Error {
  constructor(pipelineId: string) {
    super(`Pipeline ${pipelineId} not found`);
    this.name = "PipelineNotFoundError";
  }
}

export class AgentRuntimeNotFoundError extends Error {
  readonly code = "AGENT_RUNTIME_NOT_FOUND";

  constructor(runtimeConfigId?: string) {
    super(
      runtimeConfigId
        ? `Configured Agent runtime not found: ${runtimeConfigId}`
        : "No configured Agent runtime is available for this Pipeline run",
    );
    this.name = "AgentRuntimeNotFoundError";
  }
}

export class JobNotFoundError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} not found`);
    this.name = "JobNotFoundError";
  }
}

export class InvalidJobStatusError extends Error {
  constructor(action: string, jobId: string, status: string, allowed: readonly string[]) {
    super(
      `Cannot ${action} job ${jobId}: status is "${status}" but must be one of ${allowed.join(", ")}`,
    );
    this.name = "InvalidJobStatusError";
  }
}
import type { PipelineRunnerServiceBindings } from "./contracts";

import {
  createGuardJobStatusHelper,
  createPersistStatusHelper,
  createBuildDepsForJobHelper,
  createBuildMcpConnectorInjectionProviderHelper,
} from "./helpers";

import {
  createStartRunMethod,
  createPauseRunMethod,
  createResumeRunMethod,
  createCancelRunMethod,
  createResolveDecisionMethod,
} from "./methods";

export const createPipelineRunnerService = (
  db: DbConnection,
  options: PipelineRunnerServiceOptions = {},
) => {
  const serviceBindings: PipelineRunnerServiceBindings = {
    get PipelineNotFoundError() {
      return PipelineNotFoundError;
    },
    get AgentRuntimeNotFoundError() {
      return AgentRuntimeNotFoundError;
    },
    get JobNotFoundError() {
      return JobNotFoundError;
    },
    get InvalidJobStatusError() {
      return InvalidJobStatusError;
    },
    get db() {
      return db;
    },
    get options() {
      return options;
    },
    get agentsDao() {
      return agentsDao;
    },
    get operationsDao() {
      return operationsDao;
    },
    get pipelinesDao() {
      return pipelinesDao;
    },
    get jobsDao() {
      return jobsDao;
    },
    get pipelineRunsDao() {
      return pipelineRunsDao;
    },
    get jobTracesDao() {
      return jobTracesDao;
    },
    get skillsDao() {
      return skillsDao;
    },
    get agentRawExportsDao() {
      return agentRawExportsDao;
    },
    get agentSpansDao() {
      return agentSpansDao;
    },
    get settingsDao() {
      return settingsDao;
    },
    get agentRuntimesDao() {
      return agentRuntimesDao;
    },
    get connectorsDao() {
      return connectorsDao;
    },
    get guardJobStatus() {
      return guardJobStatus;
    },
    get persistStatus() {
      return persistStatus;
    },
    get buildDepsForJob() {
      return buildDepsForJob;
    },
    get buildMcpConnectorInjectionProvider() {
      return buildMcpConnectorInjectionProvider;
    },
  };

  const agentsDao = createAgentsDao(db);
  const operationsDao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const jobsDao = createJobsDao(db);
  const pipelineRunsDao = createPipelineRunsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const skillsDao = createSkillsDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const settingsDao = createSettingsDao(db);
  const agentRuntimesDao = createAgentRuntimesDao(db);
  const connectorsDao = createConnectorsDao(db);

  initObs(jobTracesDao);
  initSpanRecorder({ agentRawExportsDao, agentSpansDao });

  /** Run-control actions only apply to live jobs in an eligible status. */
  const guardJobStatus = createGuardJobStatusHelper(serviceBindings);

  const persistStatus = createPersistStatusHelper(serviceBindings);

  const buildDepsForJob = createBuildDepsForJobHelper(serviceBindings);

  const buildMcpConnectorInjectionProvider =
    createBuildMcpConnectorInjectionProviderHelper(serviceBindings);

  return {
    startRun: createStartRunMethod(serviceBindings),
    pauseRun: createPauseRunMethod(serviceBindings),
    resumeRun: createResumeRunMethod(serviceBindings),
    cancelRun: createCancelRunMethod(serviceBindings),
    /**
     * Apply a human decision: wake the suspended decision node (the job stays
     * "running", no status change needed). `selectedCandidateIds` are the
     * candidateId values from PipelineDecisionEvent.candidates (incoming edge
     * ids), not node ids.
     */
    resolveDecision: createResolveDecisionMethod(serviceBindings),
  };
};
