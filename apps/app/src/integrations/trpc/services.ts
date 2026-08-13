import { db } from "@repo/db";
import {
  createAgentsService,
  createAgentRuntimesService,
  createCapabilityHarvestService,
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
  createSettingsService,
  createSkillsService,
  createOperationOutputItemTemplatesService,
  createUsageService,
} from "@repo/services";
import { getServerEnv } from "@/integrations/server-env";

const { BETTER_AUTH_SECRET } = getServerEnv();
const capabilityExecutionOptions = { encryptionSecret: BETTER_AUTH_SECRET };

export const agentsService = createAgentsService(db);
export const agentRuntimesService = createAgentRuntimesService(db);
export const capabilityHarvestService = createCapabilityHarvestService(db, {
  encryptionSecret: BETTER_AUTH_SECRET,
});
export const connectorsService = createConnectorsService(db, capabilityExecutionOptions);
export const conversationMessagesService = createConversationMessagesService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelineAssetsService = createPipelineAssetsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db, capabilityExecutionOptions);
export const projectsService = createProjectsService(db);
export const refinementsService = createRefinementsService(db, capabilityExecutionOptions);
export const routinesService = createRoutinesService(db, {
  startRun: (opts) => pipelineRunnerService.startRun(opts),
});
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
export const operationOutputItemTemplatesService = createOperationOutputItemTemplatesService(db);
export const usageService = createUsageService(db);
