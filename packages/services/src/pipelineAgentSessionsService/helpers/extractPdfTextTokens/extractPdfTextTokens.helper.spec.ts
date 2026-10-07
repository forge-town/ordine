import { describe, expect, it } from "vitest";
import { createExtractPdfTextTokensHelper } from "./extractPdfTextTokens.helper";
import { createReadLiteralPdfStringHelper } from "../readLiteralPdfString";
import { createReadHexPdfStringHelper } from "../readHexPdfString";
import { createDecodePdfTextBytesHelper } from "../decodePdfTextBytes";
describe("extractPdfTextTokens", () => {
  it("retains the planning and attachment boundary", () => {
    const tokens = createExtractPdfTextTokensHelper({
      readLiteralPdfString: createReadLiteralPdfStringHelper({}),
      readHexPdfString: createReadHexPdfStringHelper({
        decodePdfTextBytes: createDecodePdfTextBytesHelper({}),
      }),
    });
    expect(tokens("[(Hello) <576F726C64>] TJ")).toEqual(["Hello", "World"]);
  });
});
