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
  createRecipesService,
  createRulesService,
  createSettingsService,
  createSkillsService,
} from "@repo/services";

const bestPracticesDao = createBestPracticesDao(db);
const checklistItemsDao = createChecklistItemsDao(db);
const checklistResultsDao = createChecklistResultsDao(db);
const codeSnippetsDao = createCodeSnippetsDao(db);
export const bestPracticesService = createBestPracticesService(bestPracticesDao);
export const checklistService = createChecklistService(checklistItemsDao, checklistResultsDao);
export const codeSnippetsService = createCodeSnippetsService(codeSnippetsDao);

export const bestPracticesBulkService = createBestPracticesBulkService({
  bpDao: bestPracticesDao,
  bpDaoFactory: createBestPracticesDao,
  checklistDao: checklistItemsDao,
  checklistDaoFactory: createChecklistItemsDao,
  snippetsDao: codeSnippetsDao,
  snippetsDaoFactory: createCodeSnippetsDao,
  bpService: bestPracticesService,
  checklistService,
  codeSnippetsService,
  runTransaction: db.transaction.bind(db),
});
export const githubProjectsService = createGithubProjectsService(createGithubProjectsDao(db));
export const jobsService = createJobsService(createJobsDao(db), createJobTracesDao(db));
export const operationsService = createOperationsService(createOperationsDao(db));
export const pipelinesService = createPipelinesService(createPipelinesDao(db));
export const recipesService = createRecipesService(createRecipesDao(db));
export const rulesService = createRulesService(createRulesDao(db));
export const settingsService = createSettingsService(createSettingsDao(db));
const skillsDao = createSkillsDao(db);
export { skillsDao };
export const skillsService = createSkillsService(skillsDao);
