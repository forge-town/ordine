import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { createExtractPdfStreamBodiesHelper } from "./extractPdfStreamBodies.helper";
import { createDecodePdfBinaryHelper } from "../decodePdfBinary";
describe("extractPdfStreamBodies", () => {
  it("decodes a compressed PDF text stream and preserves raw documents without streams", () => {
    const compressed = deflateSync(Buffer.from("(Hello PDF) Tj"));
    const bytes = Buffer.concat([
      Buffer.from("<< /Filter /FlateDecode >>\nstream\n"),
      compressed,
      Buffer.from("\nendstream"),
    ]);
    const extract = createExtractPdfStreamBodiesHelper({
      decodePdfBinary: createDecodePdfBinaryHelper({}),
    });
    expect(extract(bytes)).toEqual(["(Hello PDF) Tj"]);
    expect(extract(Buffer.from("plain raw"))).toEqual(["plain raw"]);
  });
});
