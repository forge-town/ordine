import type { ResultAsync } from "neverthrow";

import { type OperationCapabilityValidationInput } from "../../contracts";

import type { createValidateTargetsHelper } from "../../helpers/validateTargets";
export const createValidateOperationInputsMethod =
  (validateTargets: ReturnType<typeof createValidateTargetsHelper>) =>
  (inputs: ReadonlyArray<OperationCapabilityValidationInput>): ResultAsync<void, Error> =>
    validateTargets(
      inputs.map((input, index) => ({
        config: input.config,
        configPath: `operations[${index}].config`,
        sourceSkillId: input.sourceSkillId,
        sourceSkillIdPath: `operations[${index}].sourceSkillId`,
      })),
    );
