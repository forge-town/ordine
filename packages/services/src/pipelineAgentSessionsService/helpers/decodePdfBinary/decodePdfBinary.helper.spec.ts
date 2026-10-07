import { describe, expect, it } from "vitest";
import { createDecodePdfBinaryHelper } from "./decodePdfBinary.helper";

describe("decodePdfBinary", () => {
  it("retains the planning and attachment boundary", () => {
    expect(
      [...createDecodePdfBinaryHelper({})(new Uint8Array([0, 128, 255]))].map((c) =>
        c.codePointAt(0),
      ),
    ).toEqual([0, 128, 255]);
  });
});
