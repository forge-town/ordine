import { db } from "@repo/db";
import { createBestPracticesService } from "./bestPracticesService";
import { createBestPracticesBulkService } from "./bestPracticesBulkService";
import { createChecklistService } from "./checklistService";
import { createCodeSnippetsService } from "./codeSnippetsService";
import { createDistillationsService } from "./distillationsService";
import { createGithubProjectsService } from "./githubProjectsService";
import { createJobsService } from "./jobsService";
import { createOperationsService } from "./operationsService";
import { createPipelinesService } from "./pipelinesService";
import { createPipelineRunnerService } from "./pipelineRunnerService";
import { createRecipesService } from "./recipesService";
import { createRefinementsService } from "./refinementsService";
import { createRulesService } from "./rulesService";
import { createSettingsService } from "./settingsService";
import { createSkillsService } from "./skillsService";

export const serviceFactory = {
  createBestPracticesService: () => createBestPracticesService(db),
  createBestPracticesBulkService: () => createBestPracticesBulkService(db),
  createChecklistService: () => createChecklistService(db),
  createCodeSnippetsService: () => createCodeSnippetsService(db),
  createDistillationsService: () => createDistillationsService(db),
  createGithubProjectsService: () => createGithubProjectsService(db),
  createJobsService: () => createJobsService(db),
  createOperationsService: () => createOperationsService(db),
  createPipelinesService: () => createPipelinesService(db),
  createPipelineRunnerService: () => createPipelineRunnerService(db),
  createRecipesService: () => createRecipesService(db),
  createRefinementsService: () => createRefinementsService(db),
  createRulesService: () => createRulesService(db),
  createSettingsService: () => createSettingsService(db),
  createSkillsService: () => createSkillsService(db),
};
