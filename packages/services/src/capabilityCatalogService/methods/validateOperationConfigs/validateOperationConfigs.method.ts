import type { ResultAsync } from "neverthrow";

import type { createValidateTargetsHelper } from "../../helpers/validateTargets";
export const createValidateOperationConfigsMethod =
  (validateTargets: ReturnType<typeof createValidateTargetsHelper>) =>
  (configs: ReadonlyArray<unknown>): ResultAsync<void, Error> =>
    validateTargets(configs.map((config, index) => ({ config, configPath: `configs[${index}]` })));
