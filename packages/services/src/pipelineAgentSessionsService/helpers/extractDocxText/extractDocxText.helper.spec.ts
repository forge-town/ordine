import { describe, expect, it } from "vitest";
import { createExtractDocxTextHelper } from "./extractDocxText.helper";
import JSZip from "jszip";
import { createNormalizeWhitespaceHelper } from "../normalizeWhitespace";
describe("extractDocxText", () => {
  it("retains the planning and attachment boundary", async () => {
    const zip = new JSZip();
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const extract = createExtractDocxTextHelper({
      normalizeWhitespace: createNormalizeWhitespaceHelper({}),
    });
    expect(await extract(bytes)).toBe("");
  });
});
