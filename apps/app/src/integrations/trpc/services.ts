import {
  createBestPracticesDao,
  createChecklistItemsDao,
  createChecklistResultsDao,
  createCodeSnippetsDao,
  createGithubProjectsDao,
  createJobsDao,
  createJobTracesDao,
  createOperationsDao,
  createPipelinesDao,
  createRecipesDao,
  createRulesDao,
  createSettingsDao,
  createSkillsDao,
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
  createPipelineRunnerService,
  createRecipesService,
  createRulesService,
  createSettingsService,
  createSkillsService,
} from "@repo/services";

const bestPracticesDao = createBestPracticesDao(db);
const checklistItemsDao = createChecklistItemsDao(db);
const checklistResultsDao = createChecklistResultsDao(db);
const codeSnippetsDao = createCodeSnippetsDao(db);
const jobsDao = createJobsDao(db);
const jobTracesDao = createJobTracesDao(db);
const operationsDao = createOperationsDao(db);
const pipelinesDao = createPipelinesDao(db);
const rulesDao = createRulesDao(db);
const settingsDao = createSettingsDao(db);
const skillsDao = createSkillsDao(db);
export const bestPracticesService = createBestPracticesService(bestPracticesDao);
export const checklistService = createChecklistService(checklistItemsDao, checklistResultsDao);
export const codeSnippetsService = createCodeSnippetsService(codeSnippetsDao);

export const bestPracticesBulkService = createBestPracticesBulkService({
  bpDao: bestPracticesDao,
  bpDaoFactory: createBestPracticesDao,
  checklistItemsDao: checklistItemsDao,
  checklistDaoFactory: createChecklistItemsDao,
  codeSnippetsDao: codeSnippetsDao,
  snippetsDaoFactory: createCodeSnippetsDao,
  runTransaction: db.transaction.bind(db),
});
export const githubProjectsService = createGithubProjectsService(createGithubProjectsDao(db));
export const jobsService = createJobsService(jobsDao, jobTracesDao);
export const operationsService = createOperationsService(operationsDao);
export const pipelinesService = createPipelinesService(pipelinesDao);
export const pipelineRunnerService = createPipelineRunnerService({
  operationsDao,
  pipelinesDao,
  jobsDao,
  jobTracesDao,
  skillsDao,
  bestPracticesDao,
  settingsDao,
  rulesDao,
});
export const recipesService = createRecipesService(createRecipesDao(db));
export const rulesService = createRulesService(rulesDao);
export const settingsService = createSettingsService(settingsDao);
export const skillsService = createSkillsService(skillsDao);
