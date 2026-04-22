import { db } from "@repo/db";
import { createBestPracticesService } from "../bestPracticesService";
import { createBestPracticesBulkService } from "../bestPracticesBulkService";
import { createChecklistService } from "../checklistService";
import { createCodeSnippetsService } from "../codeSnippetsService";
import { createGithubProjectsService } from "../githubProjectsService";
import { createJobsService } from "../jobsService";
import { createLlmService } from "../llmService";
import { createOperationsService } from "../operationsService";
import { createPipelinesService } from "../pipelinesService";
import { createPipelineRunnerService } from "../pipelineRunnerService";
import { createRecipesService } from "../recipesService";
import { createRulesService } from "../rulesService";
import { createSettingsService } from "../settingsService";
import { createSkillsService } from "../skillsService";
import type { DbConnection } from "@repo/models";

export class ServiceFactory {
  private readonly db: DbConnection;

  constructor(db: DbConnection) {
    this.db = db;
  }

  createBestPracticesService() {
    return createBestPracticesService(this.db);
  }

  createBestPracticesBulkService() {
    return createBestPracticesBulkService(this.db);
  }

  createChecklistService() {
    return createChecklistService(this.db);
  }

  createCodeSnippetsService() {
    return createCodeSnippetsService(this.db);
  }

  createGithubProjectsService() {
    return createGithubProjectsService(this.db);
  }

  createJobsService() {
    return createJobsService(this.db);
  }

  createLlmService() {
    return createLlmService(this.db);
  }

  createOperationsService() {
    return createOperationsService(this.db);
  }

  createPipelinesService() {
    return createPipelinesService(this.db);
  }

  createPipelineRunnerService() {
    return createPipelineRunnerService(this.db);
  }

  createRecipesService() {
    return createRecipesService(this.db);
  }

  createRulesService() {
    return createRulesService(this.db);
  }

  createSettingsService() {
    return createSettingsService(this.db);
  }

  createSkillsService() {
    return createSkillsService(this.db);
  }
}

export const serviceFactory = new ServiceFactory(db);
