import type { ResultAsync } from "neverthrow";

import { type OperationCapabilityValidationInput } from "../../contracts";

import type { createValidateTargetsHelper } from "../../helpers/validateTargets";
export const createValidateOperationInputMethod =
  (validateTargets: ReturnType<typeof createValidateTargetsHelper>) =>
  (input: OperationCapabilityValidationInput): ResultAsync<void, Error> =>
    validateTargets([
      {
        config: input.config,
        configPath: "config",
        sourceSkillId: input.sourceSkillId,
        sourceSkillIdPath: "sourceSkillId",
      },
    ]);
