import type { OperationConfigShapeValidationIssue } from "../../contracts";

export const operationConfigValidationMessage = (
  issues: OperationConfigShapeValidationIssue[],
): string => {
  const summaries = issues.slice(0, 3).map((issue) => `${issue.path}: ${issue.message}`);
  const remainder =
    issues.length > summaries.length ? `; +${issues.length - summaries.length} more` : "";

  return `Invalid operation config${issues.length === 1 ? "" : "s"}: ${summaries.join("; ")}${remainder}`;
};
