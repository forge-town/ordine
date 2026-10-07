import type { CapabilityCatalogEntry } from "@repo/schemas";

export const riskForReference = (
  reference: string,
  entries: CapabilityCatalogEntry[],
): CapabilityCatalogEntry | null => entries.find((entry) => entry.reference === reference) ?? null;
