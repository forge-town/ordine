import { db } from "@repo/db";
import { createAgentsService } from "./agentsService";
import { createDistillationsService } from "./distillationsService";
import { createGithubProjectsService } from "./githubProjectsService";
import { createJobsService } from "./jobsService";
import { createOperationsService } from "./operationsService";
import { createPipelinesService } from "./pipelinesService";
import { createPipelineRunnerService } from "./pipelineRunnerService";
import { createRefinementsService } from "./refinementsService";
import { createSettingsService } from "./settingsService";
import { createSkillsService } from "./skillsService";

export const serviceFactory = {
  createAgentsService: () => createAgentsService(db),
  createDistillationsService: () => createDistillationsService(db),
  createGithubProjectsService: () => createGithubProjectsService(db),
  createJobsService: () => createJobsService(db),
  createOperationsService: () => createOperationsService(db),
  createPipelinesService: () => createPipelinesService(db),
  createPipelineRunnerService: () => createPipelineRunnerService(db),
  createRefinementsService: () => createRefinementsService(db),
  createSettingsService: () => createSettingsService(db),
  createSkillsService: () => createSkillsService(db),
};
