import { StrictOperationConfigSchema, type OperationConfig } from "@repo/schemas";

import type { OperationConfigShapeValidationIssue } from "../../contracts";
import { appendZodPath } from "../appendZodPath";
export type ValidationTarget = {
  config?: unknown;
  configPath?: string;
  sourceSkillId?: unknown;
  sourceSkillIdPath?: string;
};
export type ParsedValidationTarget = Omit<ValidationTarget, "config"> & {
  config?: OperationConfig;
};

export const parseValidationTargets = (
  targets: ValidationTarget[],
): { parsedTargets: ParsedValidationTarget[]; issues: OperationConfigShapeValidationIssue[] } => {
  const issues: OperationConfigShapeValidationIssue[] = [];
  const parsedTargets = targets.map((target) => {
    const parsedTarget: ParsedValidationTarget = { ...target, config: undefined };
    if (target.configPath) {
      const parsed = StrictOperationConfigSchema.safeParse(target.config);
      if (parsed.success) {
        parsedTarget.config = parsed.data;
      } else {
        issues.push(
          ...parsed.error.issues.map((issue) => ({
            path: appendZodPath(target.configPath!, issue.path),
            message: issue.message,
          })),
        );
      }
    }

    if (
      target.sourceSkillIdPath &&
      target.sourceSkillId !== undefined &&
      target.sourceSkillId !== null &&
      typeof target.sourceSkillId !== "string"
    ) {
      issues.push({
        path: target.sourceSkillIdPath,
        message: "Expected a skill id string",
      });
    }

    return parsedTarget;
  });

  return { parsedTargets, issues };
};
