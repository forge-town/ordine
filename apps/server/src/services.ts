import {
  bestPracticesDao,
  checklistItemsDao,
  checklistResultsDao,
  codeSnippetsDao,
  jobsDao,
  operationsDao,
  pipelinesDao,
  recipesDao,
  rulesDao,
  skillsDao,
  worksDao,
} from "@repo/models";
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
  createWorksService,
  listDirectory,
} from "@repo/services";

export const bestPracticesService = createBestPracticesService(bestPracticesDao);
export const checklistService = createChecklistService(checklistItemsDao, checklistResultsDao);
export const codeSnippetsService = createCodeSnippetsService(codeSnippetsDao);
export const jobsService = createJobsService(jobsDao);
export const operationsService = createOperationsService(operationsDao);
export const pipelinesService = createPipelinesService(pipelinesDao);
export const recipesService = createRecipesService(recipesDao);
export const rulesService = createRulesService(rulesDao);
export const skillsService = createSkillsService(skillsDao);
export const worksService = createWorksService(worksDao);
export { listDirectory, skillsDao, jobsDao, pipelinesDao };
