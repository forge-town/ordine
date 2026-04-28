import { db } from "@repo/db";
import {
  createBestPracticesBulkService,
  createBestPracticesService,
  createChecklistService,
  createCodeSnippetsService,
  createDistillationsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createPipelineRunnerService,
  createPipelinesService,
  createRecipesService,
  createRefinementsService,
  createRulesService,
  createSettingsService,
  createSkillsService,
} from "@repo/services";

export const bestPracticesService = createBestPracticesService(db);
export const bestPracticesBulkService = createBestPracticesBulkService(db);
export const checklistService = createChecklistService(db);
export const codeSnippetsService = createCodeSnippetsService(db);
export const distillationsService = createDistillationsService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const recipesService = createRecipesService(db);
export const refinementsService = createRefinementsService(db);
export const rulesService = createRulesService(db);
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
