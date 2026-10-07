import { type CapabilityCatalogValidationIssue } from "@repo/schemas";

export const capabilityValidationMessage = (issues: CapabilityCatalogValidationIssue[]): string => {
  const summaries = issues
    .slice(0, 3)
    .map((issue) =>
      issue.runtime
        ? `${issue.path}: ${issue.reference} is not available for ${issue.runtime}`
        : `${issue.path}: ${issue.reference}`,
    );
  const remainder =
    issues.length > summaries.length ? `; +${issues.length - summaries.length} more` : "";

  return `Invalid capability reference${issues.length === 1 ? "" : "s"}: ${summaries.join("; ")}${remainder}`;
};
