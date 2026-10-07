import { describe, expect, it } from "vitest";
import { createReadLiteralPdfStringHelper } from "./readLiteralPdfString.helper";
describe("readLiteralPdfString", () => {
  it("decodes escaped parentheses, newline and octal text while consuming the closing delimiter", () => {
    const input = String.raw`(line\nwith \(nested\) and \101)`;
    expect(createReadLiteralPdfStringHelper({})(input + " rest", 0)).toEqual({
      value: "line\nwith (nested) and A",
      nextIndex: input.length,
    });
  });
});
