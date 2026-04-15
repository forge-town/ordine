import {
  createBestPracticesDao,
  checklistItemsDao,
  checklistResultsDao,
  codeSnippetsDao,
  githubProjectsDao,
  jobsDao,
  operationsDao,
  pipelinesDao,
  recipesDao,
  rulesDao,
  settingsDao,
  skillsDao,
} from "@repo/models";
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
  createRecipesService,
  createRulesService,
  createSettingsService,
  createSkillsService,
} from "@repo/services";

const bestPracticesDao = createBestPracticesDao(db);
export const bestPracticesService = createBestPracticesService(bestPracticesDao);
export const checklistService = createChecklistService(checklistItemsDao, checklistResultsDao);
export const codeSnippetsService = createCodeSnippetsService(codeSnippetsDao);

export const bestPracticesBulkService = createBestPracticesBulkService({
  bpDao: bestPracticesDao,
  bpDaoFactory: createBestPracticesDao,
  checklistDao: checklistItemsDao,
  snippetsDao: codeSnippetsDao,
  bpService: bestPracticesService,
  checklistService,
  codeSnippetsService,
  runTransaction: db.transaction.bind(db),
});
export const githubProjectsService = createGithubProjectsService(githubProjectsDao);
export const jobsService = createJobsService(jobsDao);
export const operationsService = createOperationsService(operationsDao);
export const pipelinesService = createPipelinesService(pipelinesDao);
export const recipesService = createRecipesService(recipesDao);
export const rulesService = createRulesService(rulesDao);
export const settingsService = createSettingsService(settingsDao);
export const skillsService = createSkillsService(skillsDao);
