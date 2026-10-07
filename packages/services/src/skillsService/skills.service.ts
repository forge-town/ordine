import { createSkillsDao, createSettingsDao, type DbConnection } from "@repo/models";

import {
  createGetAllMethod,
  createGetByIdMethod,
  createGetByNameMethod,
  createCreateMethod,
  createUpdateMethod,
  createDeleteMethod,
  createSeedIfEmptyMethod,
  createBuildDraftOperationMethod,
  createPreviewImportMethod,
  createImportCandidatesMethod,
  createAnalyzeSkillMethod,
} from "./methods";
import { createBuildFallbackHelper } from "./helpers/buildFallback";
export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);
  const settingsDao = createSettingsDao(db);
  const buildFallback = createBuildFallbackHelper();

  return {
    getAll: createGetAllMethod(dao),
    getById: createGetByIdMethod(dao),
    getByName: createGetByNameMethod(dao),
    create: createCreateMethod(dao),
    update: createUpdateMethod(dao),
    delete: createDeleteMethod(dao),
    seedIfEmpty: createSeedIfEmptyMethod(dao),
    buildDraftOperation: createBuildDraftOperationMethod(),
    previewImport: createPreviewImportMethod(),
    importCandidates: createImportCandidatesMethod(dao),
    analyzeSkill: createAnalyzeSkillMethod(settingsDao, buildFallback),
  };
};
