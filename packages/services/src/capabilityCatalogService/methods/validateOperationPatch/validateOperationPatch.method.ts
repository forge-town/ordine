import type { ResultAsync } from "neverthrow";

import { type OperationCapabilityValidationInput } from "../../contracts";

import type { createValidateTargetsHelper } from "../../helpers/validateTargets";
export const createValidateOperationPatchMethod =
  (validateTargets: ReturnType<typeof createValidateTargetsHelper>) =>
  (patch: OperationCapabilityValidationInput): ResultAsync<void, Error> =>
    validateTargets([
      {
        ...(Object.hasOwn(patch, "config") ? { config: patch.config, configPath: "config" } : {}),
        ...(Object.hasOwn(patch, "sourceSkillId")
          ? {
              sourceSkillId: patch.sourceSkillId,
              sourceSkillIdPath: "sourceSkillId",
            }
          : {}),
      },
    ]);
