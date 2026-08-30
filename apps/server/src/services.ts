import { db } from "@repo/db";
import {
  configureAgentRunController,
  createAgentControlService,
  createAgentThreadsService,
  createAgentsService,
  createAgentRunsService,
  createAgentRunController,
  createAgentRuntimesService,
  createConnectorsService,
  createConversationMessagesService,
  createDistillationsService,
  createJobsService,
  createOperationsService,
  createOperationRunnerService,
  createPipelineAgentSessionsService,
  createPipelineAssetsService,
  createPipelineRunnerService,
  createPipelinesService,
  createProjectsService,
  createRoutinesService,
  createSkillsService,
  createUsageService,
  DEFAULT_JOB_HEARTBEAT_INTERVAL_MS,
  DEFAULT_JOB_LEASE_DURATION_MS,
  agentRunCapabilityStore,
  listDirectory,
} from "@repo/services";
import { getEnv } from "./integrations/env";

const env = getEnv();
const jobLease = {
  leaseDurationMs: env.JOB_LEASE_DURATION_MS ?? DEFAULT_JOB_LEASE_DURATION_MS,
  heartbeatIntervalMs: env.JOB_HEARTBEAT_INTERVAL_MS ?? DEFAULT_JOB_HEARTBEAT_INTERVAL_MS,
};
if (jobLease.heartbeatIntervalMs >= jobLease.leaseDurationMs) {
  throw new Error("JOB_HEARTBEAT_INTERVAL_MS must be less than JOB_LEASE_DURATION_MS");
}

export const agentsService = createAgentsService(db);
export const agentRunsService = createAgentRunsService(db);
const agentRunController = createAgentRunController(agentRunsService);
configureAgentRunController(agentRunController);
export const agentRuntimesService = createAgentRuntimesService(db);
export const connectorsService = createConnectorsService(db);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db, jobLease);
export const pipelineAgentSessionsService = createPipelineAgentSessionsService(db, {
  agentRunsService,
});
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db, {
  agentRunController,
  jobLease,
});
export const projectsService = createProjectsService(db);
export const routinesService = createRoutinesService(db, {
  startRun: (opts) => pipelineRunnerService.startRun(opts),
});
export const skillsService = createSkillsService(db);
export const usageService = createUsageService(db);

export const agentThreadsService = createAgentThreadsService(db);
export const agentControlService = createAgentControlService(db, {
  runEvents: {
    getRun: (runId) => agentRunsService.getById(runId),
    append: (runId, event) => agentRunsService.appendControlEvent(runId, event),
  },
  execution: {
    runPipeline: (input) => pipelineRunnerService.startRun(input),
    runOperation: (input) => operationRunnerService.startRun(input),
    runRoutine: (routineId) => routinesService.runNow(routineId),
    controlJob: (jobId, action) => {
      if (action === "pause") return pipelineRunnerService.pauseRun(jobId);
      if (action === "resume") return pipelineRunnerService.resumeRun(jobId);

      return pipelineRunnerService.cancelRun(jobId);
    },
  },
});

export { agentRunCapabilityStore, listDirectory };
