import { db } from "@repo/db";
import { createAgentsService } from "./agentsService";
import { createConnectorsService } from "./connectorsService";
import { createCapabilityCatalogService } from "./capabilityCatalogService";
import { createConversationMessagesService } from "./conversationMessagesService";
import { createDistillationsService } from "./distillationsService";
import { createGithubProjectsService } from "./githubProjectsService";
import { createJobsService } from "./jobsService";
import { createOperationsService } from "./operationsService";
import { createPipelineAssetsService } from "./pipelineAssetsService";
import { createPipelinesService } from "./pipelinesService";
import { createPipelineRunnerService } from "./pipelineRunnerService";
import { createProjectsService } from "./projectsService";
import { createRefinementsService } from "./refinementsService";
import { createRoutinesService } from "./routinesService";
import { createSettingsService } from "./settingsService";
import { createSkillsService } from "./skillsService";
import { createUsageService } from "./usageService";

const pipelineRunnerService = createPipelineRunnerService(db);

export const serviceFactory = {
  createAgentsService: () => createAgentsService(db),
  createCapabilityCatalogService: () => createCapabilityCatalogService(db),
  createConnectorsService: () => createConnectorsService(db),
  createConversationMessagesService: () => createConversationMessagesService(db),
  createDistillationsService: () => createDistillationsService(db),
  createGithubProjectsService: () => createGithubProjectsService(db),
  createJobsService: () => createJobsService(db),
  createOperationsService: () => createOperationsService(db),
  createPipelineAssetsService: () => createPipelineAssetsService(db),
  createPipelinesService: () => createPipelinesService(db),
  createPipelineRunnerService: () => createPipelineRunnerService(db),
  createProjectsService: () => createProjectsService(db),
  createRefinementsService: () => createRefinementsService(db),
  createRoutinesService: () =>
    createRoutinesService(db, {
      startRun: (opts) => pipelineRunnerService.startRun(opts),
    }),
  createSettingsService: () => createSettingsService(db),
  createSkillsService: () => createSkillsService(db),
  createUsageService: () => createUsageService(db),
};
