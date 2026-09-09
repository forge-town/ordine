import { db } from "@repo/db";
import {
  createSettingsService,
  createAgentRuntimesService,
  createGithubProjectsService,
  createOperationOutputItemTemplatesService,
  createSkillsService,
} from "@repo/services";
import { createProductMetadataRoutes } from "./productMetadata";

export const productMetadataRoutes = createProductMetadataRoutes({
  settings: createSettingsService(db),
  runtimes: createAgentRuntimesService(db),
  githubProjects: createGithubProjectsService(db),
  templates: createOperationOutputItemTemplatesService(db),
  skills: createSkillsService(db),
});
