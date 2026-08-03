import { db } from "@repo/db";
import {
  createAgentsService,
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
  listDirectory,
} from "@repo/services";

export const agentsService = createAgentsService(db);
export const connectorsService = createConnectorsService(db);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelineAgentSessionsService = createPipelineAgentSessionsService(db);
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const projectsService = createProjectsService(db);
export const routinesService = createRoutinesService(db, {
  startRun: (opts) => pipelineRunnerService.startRun(opts),
});
export const skillsService = createSkillsService(db);
export const usageService = createUsageService(db);

export { listDirectory };
