import { db } from "@repo/db";
import {
  createAgentsService,
  createAgentRuntimesService,
  createAnnotationsService,
  createConnectorsService,
  createConversationMessagesService,
  createDistillationsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createOperationRunnerService,
  createPipelineAssetsService,
  createPipelineRunnerService,
  createPipelinesService,
  createProjectsService,
  createRefinementsService,
  createRoutinesService,
  createRoutineSchedulerService,
  createSettingsService,
  createSkillsService,
  createOperationOutputItemTemplatesService,
  createUsageService,
} from "@repo/services";

export const agentsService = createAgentsService(db);
export const agentRuntimesService = createAgentRuntimesService(db);
export const annotationsService = createAnnotationsService(db);
export const connectorsService = createConnectorsService(db);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const projectsService = createProjectsService(db);
export const refinementsService = createRefinementsService(db);
export const routinesService = createRoutinesService(db);
export const routineSchedulerService = createRoutineSchedulerService(db, {
  startRun: pipelineRunnerService.startRun,
});
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
export const operationOutputItemTemplatesService = createOperationOutputItemTemplatesService(db);
export const usageService = createUsageService(db);

if (!import.meta.env.VITEST) {
  routineSchedulerService.start();
}
