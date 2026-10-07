import { type CapabilityCatalogEntry, type CapabilityCatalogValidationIssue } from "@repo/schemas";

export const sourceSkillValidationIssues = (
  sourceSkillId: unknown,
  entries: CapabilityCatalogEntry[],
  path: string,
): CapabilityCatalogValidationIssue[] => {
  if (
    typeof sourceSkillId !== "string" ||
    entries.some((entry) => entry.kind === "skill" && entry.reference === sourceSkillId)
  ) {
    return [];
  }

  return [{ path, reference: sourceSkillId, expectedKinds: ["skill"] }];
};
