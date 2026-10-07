import {
  type CapabilityCatalogEntry,
  type CapabilityCatalogValidationIssue,
  type OperationConfig,
} from "@repo/schemas";

export const extractValidationIssues = (
  config: OperationConfig,
  entries: CapabilityCatalogEntry[],
  pathPrefix = "config",
): CapabilityCatalogValidationIssue[] => {
  const executor = config.executor;
  if (!executor) return [];

  const issues: CapabilityCatalogValidationIssue[] = [];
  const runtime = executor.agent;
  const skillId = executor.skillId;
  if (
    typeof skillId === "string" &&
    !entries.some(
      (entry) =>
        entry.kind === "skill" &&
        entry.reference === skillId &&
        (!runtime || entry.supportedRuntimes.includes(runtime)),
    )
  ) {
    issues.push({
      path: `${pathPrefix}.executor.skillId`,
      reference: skillId,
      expectedKinds: ["skill"],
      ...(runtime ? { runtime } : {}),
    });
  }

  if (executor.allowedTools) {
    executor.allowedTools.forEach((reference, index) => {
      if (
        entries.some(
          (entry) =>
            (entry.kind === "builtin-tool" || entry.kind === "mcp-tool") &&
            entry.reference === reference &&
            (!runtime || entry.supportedRuntimes.includes(runtime)),
        )
      ) {
        return;
      }

      issues.push({
        path: `${pathPrefix}.executor.allowedTools[${index}]`,
        reference,
        expectedKinds: ["builtin-tool", "mcp-tool"],
        ...(runtime ? { runtime } : {}),
      });
    });
  }

  return issues;
};
