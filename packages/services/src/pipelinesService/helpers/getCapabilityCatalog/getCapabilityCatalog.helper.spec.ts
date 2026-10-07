import { describe, expect, it } from "vitest";
import { createGetCapabilityCatalogHelper } from "./getCapabilityCatalog.helper";
describe("getCapabilityCatalog", () => {
  it("retains the Pipeline content and error boundary", () => {
    const injected = {};
    const get = createGetCapabilityCatalogHelper({
      options: { capabilityCatalog: injected },
    } as never);
    expect(get({} as never)).toBe(injected);
  });
});
