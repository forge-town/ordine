import type { ResultAsync } from "neverthrow";

import type { createValidateTargetsHelper } from "../../helpers/validateTargets";
export const createValidateOperationConfigMethod =
  (validateTargets: ReturnType<typeof createValidateTargetsHelper>) =>
  (config: unknown): ResultAsync<void, Error> =>
    validateTargets([{ config, configPath: "config" }]);
