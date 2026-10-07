import { type CapabilityCatalogEntry, type GetCapabilityCatalogInput } from "@repo/schemas";

export const filterCatalogEntries = (
  entries: CapabilityCatalogEntry[],
  input: GetCapabilityCatalogInput,
): CapabilityCatalogEntry[] => {
  const kinds = input.kinds ? new Set(input.kinds) : null;

  return entries.filter(
    (entry) =>
      (!input.runtime || entry.supportedRuntimes.includes(input.runtime)) &&
      (!kinds || kinds.has(entry.kind)),
  );
};
