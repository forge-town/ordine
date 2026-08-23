import type { AgentRuntimeCatalogEntry } from "@repo/schemas";

export const getConnectionTestEntry = (
  catalog: AgentRuntimeCatalogEntry[],
  runtimeConfigId: string | null,
): AgentRuntimeCatalogEntry | undefined => {
  if (runtimeConfigId === null) return undefined;

  return catalog.find((entry) => entry.runtimeConfigId === runtimeConfigId);
};
