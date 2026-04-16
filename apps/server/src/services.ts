import { createJobsDao, createPipelinesDao } from "@repo/models";
import { db } from "@repo/db";
import {
  createBestPracticesService,
  createChecklistService,
  createCodeSnippetsService,
  createJobsService,
  createOperationsService,
  createPipelinesService,
  createPipelineRunnerService,
  createRecipesService,
  createRulesService,
  createSkillsService,
  listDirectory,
} from "@repo/services";

export const bestPracticesService = createBestPracticesService(db);
export const checklistService = createChecklistService(db);
export const codeSnippetsService = createCodeSnippetsService(db);
export const jobsService = createJobsService(db);
export const operationsService = createOperationsService(db);
export const pipelinesService = createPipelinesService(db);
export const pipelineRunnerService = createPipelineRunnerService(db);
export const recipesService = createRecipesService(db);
export const rulesService = createRulesService(db);
export const skillsService = createSkillsService(db);

export { listDirectory };
