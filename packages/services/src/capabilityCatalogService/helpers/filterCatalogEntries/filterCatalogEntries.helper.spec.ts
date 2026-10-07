import { describe, expect, it } from "vitest";
import { filterCatalogEntries } from "./filterCatalogEntries.helper";
import { projectCapabilityCatalog } from "../catalogProjection";
describe("filterCatalogEntries", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    const entries = projectCapabilityCatalog({ connectors: [], skills: [], overrides: [] });
    expect(filterCatalogEntries(entries, { runtime: "hermes" })).toEqual([]);
    expect(filterCatalogEntries(entries, { kinds: [] })).toEqual([]);
    expect(filterCatalogEntries(entries, {})).toEqual(entries);
  });
});
