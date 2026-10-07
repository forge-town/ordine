import {
  createCapabilityRiskOverridesDao,
  createConnectorsDao,
  createSkillsDao,
  type DbExecutor,
} from "@repo/models";

import type {
  CapabilityCatalogServiceDependencies,
  CapabilityCatalogServiceOptions,
} from "./contracts";
import {
  createGetManyMethod,
  createValidateOperationConfigsMethod,
  createValidateOperationConfigMethod,
  createValidateOperationInputMethod,
  createValidateOperationInputsMethod,
  createValidateOperationPatchMethod,
  createSetRiskTierOverrideMethod,
} from "./methods";
import { createLoadEntriesHelper, createValidateTargetsHelper } from "./helpers";
export const createCapabilityCatalogService = (
  db: DbExecutor,
  options: CapabilityCatalogServiceOptions = {},
) => {
  const dependencies =
    options.dependencies ??
    ({
      connectorsDao: createConnectorsDao(db),
      skillsDao: createSkillsDao(db),
      riskOverridesDao: createCapabilityRiskOverridesDao(db),
    } satisfies CapabilityCatalogServiceDependencies);
  const loadEntries = createLoadEntriesHelper(dependencies);
  const getMany = createGetManyMethod(loadEntries);
  const validateTargets = createValidateTargetsHelper(loadEntries);
  const validateOperationConfigs = createValidateOperationConfigsMethod(validateTargets);
  const validateOperationConfig = createValidateOperationConfigMethod(validateTargets);
  const validateOperationInput = createValidateOperationInputMethod(validateTargets);
  const validateOperationInputs = createValidateOperationInputsMethod(validateTargets);
  const validateOperationPatch = createValidateOperationPatchMethod(validateTargets);
  const setRiskTierOverride = createSetRiskTierOverrideMethod(dependencies, loadEntries);

  return {
    getMany,
    setRiskTierOverride,
    validateOperationConfig,
    validateOperationConfigs,
    validateOperationInput,
    validateOperationInputs,
    validateOperationPatch,
  };
};
