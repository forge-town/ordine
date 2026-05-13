import { db } from "@repo/db";
import {
  createAgentsService,
  createAgentRuntimesService,
  createDistillationsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createOperationRunnerService,
  createPipelineRunnerService,
  createPipelinesService,
  createRecipesService,
  createRefinementsService,
  createSettingsService,
  createSkillsService,
  createOperationOutputItemTemplatesService,
} from "@repo/services";

export const agentsService = createAgentsService(db);
export const agentRuntimesService = createAgentRuntimesService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const operationRunnerService = createOperationRunnerService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const recipesService = createRecipesService(db);
export const refinementsService = createRefinementsService(db);
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
export const operationOutputItemTemplatesService = createOperationOutputItemTemplatesService(db);
