import { errAsync, okAsync, type ResultAsync } from "neverthrow";

import { CapabilityCatalogValidationError, OperationConfigValidationError } from "../../contracts";

import { extractValidationIssues } from "../extractValidationIssues";
import { sourceSkillValidationIssues } from "../sourceSkillValidationIssues";
import { type ValidationTarget, parseValidationTargets } from "../parseValidationTargets";
import type { createLoadEntriesHelper } from "../loadEntries";
export const createValidateTargetsHelper =
  (loadEntries: ReturnType<typeof createLoadEntriesHelper>) =>
  (targets: ValidationTarget[]): ResultAsync<void, Error> => {
    const { parsedTargets, issues: shapeIssues } = parseValidationTargets(targets);
    if (shapeIssues.length > 0) {
      return errAsync(new OperationConfigValidationError(shapeIssues));
    }

    return loadEntries().andThen((entries) => {
      const issues = parsedTargets.flatMap((target) => [
        ...(target.config && target.configPath
          ? extractValidationIssues(target.config, entries, target.configPath)
          : []),
        ...(target.sourceSkillIdPath
          ? sourceSkillValidationIssues(target.sourceSkillId, entries, target.sourceSkillIdPath)
          : []),
      ]);

      return issues.length > 0
        ? errAsync(new CapabilityCatalogValidationError(issues))
        : okAsync(undefined);
    });
  };
