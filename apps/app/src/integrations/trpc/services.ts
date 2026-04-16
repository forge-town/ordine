import { db } from "@repo/db";
import {
  createBestPracticesService,
  createBestPracticesBulkService,
  createChecklistService,
  createCodeSnippetsService,
  createGithubProjectsService,
  createJobsService,
  createOperationsService,
  createPipelinesService,
  createPipelineRunnerService,
  createRecipesService,
  createRulesService,
  createSettingsService,
  createSkillsService,
} from "@repo/services";

export const bestPracticesService = createBestPracticesService(db);
export const checklistService = createChecklistService(db);
export const codeSnippetsService = createCodeSnippetsService(db);
export const bestPracticesBulkService = createBestPracticesBulkService(db);
export const githubProjectsService = createGithubProjectsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const recipesService = createRecipesService(db);
export const rulesService = createRulesService(db);
export const settingsService = createSettingsService(db);
export const skillsService = createSkillsService(db);
