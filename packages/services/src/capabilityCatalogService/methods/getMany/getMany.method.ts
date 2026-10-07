import { type GetCapabilityCatalogInput } from "@repo/schemas";

import { filterCatalogEntries } from "../../helpers/filterCatalogEntries";
import type { createLoadEntriesHelper } from "../../helpers/loadEntries";
export const createGetManyMethod =
  (loadEntries: ReturnType<typeof createLoadEntriesHelper>) =>
  (input: GetCapabilityCatalogInput = {}) =>
    loadEntries().map((entries) => filterCatalogEntries(entries, input));
