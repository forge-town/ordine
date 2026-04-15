import {
  createBestPracticesDao,
  createChecklistItemsDao,
  createChecklistResultsDao,
  createCodeSnippetsDao,
  createJobsDao,
  createOperationsDao,
  createPipelinesDao,
  createRecipesDao,
  createRulesDao,
  createSkillsDao,
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
const checklistItemsDao = createChecklistItemsDao(db);
const checklistResultsDao = createChecklistResultsDao(db);
const codeSnippetsDao = createCodeSnippetsDao(db);
const jobsDao = createJobsDao(db);
const operationsDao = createOperationsDao(db);
const pipelinesDao = createPipelinesDao(db);
const recipesDao = createRecipesDao(db);
const rulesDao = createRulesDao(db);
const skillsDao = createSkillsDao(db);
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
