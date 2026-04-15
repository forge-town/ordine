import {
  createBestPracticesDao,
  checklistItemsDao,
  checklistResultsDao,
  codeSnippetsDao,
  jobsDao,
  operationsDao,
  pipelinesDao,
  recipesDao,
  rulesDao,
  skillsDao,
} from "@repo/models";
import { db } from "@repo/db";
import {
  createBestPracticesService,
  createChecklistService,
  createCodeSnippetsService,
  createJobsService,
  createOperationsService,
  createPipelinesService,
  createRecipesService,
  createRulesService,
  createSkillsService,
  listDirectory,
} from "@repo/services";

const bestPracticesDao = createBestPracticesDao(db);
export const bestPracticesService = createBestPracticesService(bestPracticesDao);
export const checklistService = createChecklistService(checklistItemsDao, checklistResultsDao);
export const codeSnippetsService = createCodeSnippetsService(codeSnippetsDao);
export const jobsService = createJobsService(jobsDao);
export const operationsService = createOperationsService(operationsDao);
export const pipelinesService = createPipelinesService(pipelinesDao);
export const recipesService = createRecipesService(recipesDao);
export const rulesService = createRulesService(rulesDao);
export const skillsService = createSkillsService(skillsDao);
export { listDirectory, skillsDao, jobsDao, pipelinesDao };
