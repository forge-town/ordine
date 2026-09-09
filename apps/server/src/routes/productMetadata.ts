import { Hono } from "hono";
import type {
  createSettingsService,
  createAgentRuntimesService,
  createGithubProjectsService,
  createOperationOutputItemTemplatesService,
  createSkillsService,
} from "@repo/services";
import { createMetadataCrudRoutes, metadataResult } from "./metadataCrud";
import { resultJson, validateJson, validationErrorJson } from "./result";
import {
  MetadataSettingsPatchSchema,
  MetadataRuntimeSchema,
  MetadataRuntimePatchSchema,
  MetadataRuntimeSyncSchema,
  MetadataGithubProjectSchema,
  MetadataGithubProjectPatchSchema,
  MetadataTemplateSchema,
  MetadataTemplatePatchSchema,
  MetadataSkillPreviewSchema,
  MetadataSkillImportSchema,
} from "./productMetadataSchemas";

export type ProductMetadataServices = {
  settings: Pick<ReturnType<typeof createSettingsService>, "get" | "update">;
  runtimes: ReturnType<typeof createAgentRuntimesService>;
  githubProjects: ReturnType<typeof createGithubProjectsService>;
  templates: ReturnType<typeof createOperationOutputItemTemplatesService>;
  skills: Pick<ReturnType<typeof createSkillsService>, "previewImport" | "importCandidates">;
};

/** Mount at /api before the existing dynamic authoring routes. */
export const createProductMetadataRoutes = (services: ProductMetadataServices) => {
  const router = new Hono();
  router.get("/settings/default", async (c) =>
    resultJson(c, await metadataResult(() => services.settings.get())),
  );
  router.patch("/settings/default", async (c) => {
    const parsed = await validateJson(c, MetadataSettingsPatchSchema);
    if (!parsed.success) return validationErrorJson(c);

    return resultJson(c, await metadataResult(() => services.settings.update(parsed.data)));
  });
  router.post("/agent-runtimes/sync-all", async (c) => {
    const parsed = await validateJson(c, MetadataRuntimeSyncSchema);
    if (!parsed.success) return validationErrorJson(c);

    return resultJson(
      c,
      await metadataResult(() => services.runtimes.syncAll(parsed.data.runtimes)),
    );
  });
  router.post("/skills/preview-import", async (c) => {
    const parsed = await validateJson(c, MetadataSkillPreviewSchema);
    if (!parsed.success) return validationErrorJson(c);

    return resultJson(c, await metadataResult(() => services.skills.previewImport(parsed.data)));
  });
  router.post("/skills/import-candidates", async (c) => {
    const parsed = await validateJson(c, MetadataSkillImportSchema);
    if (!parsed.success) return validationErrorJson(c);

    return resultJson(
      c,
      await metadataResult(() => services.skills.importCandidates(parsed.data.candidates)),
    );
  });
  router.route(
    "/agent-runtimes",
    createMetadataCrudRoutes({
      service: services.runtimes,
      createSchema: MetadataRuntimeSchema,
      patchSchema: MetadataRuntimePatchSchema,
    }),
  );
  router.route(
    "/github-projects",
    createMetadataCrudRoutes({
      service: services.githubProjects,
      createSchema: MetadataGithubProjectSchema,
      patchSchema: MetadataGithubProjectPatchSchema,
    }),
  );
  router.route(
    "/operation-output-item-templates",
    createMetadataCrudRoutes({
      service: services.templates,
      createSchema: MetadataTemplateSchema,
      patchSchema: MetadataTemplatePatchSchema,
    }),
  );

  return router;
};
