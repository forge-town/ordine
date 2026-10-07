import { describe, expect, it } from "vitest";
import { createDecodeTextHelper } from "./decodeText.helper";

describe("decodeText", () => {
  it("retains the planning and attachment boundary", () => {
    expect(createDecodeTextHelper({})(new TextEncoder().encode("中文 brief"))).toBe("中文 brief");
  });
});
