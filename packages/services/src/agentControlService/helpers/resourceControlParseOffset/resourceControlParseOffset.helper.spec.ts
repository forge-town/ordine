import { describe, expect, it } from "vitest";
import { parseOffset } from "./resourceControlParseOffset.helper";

describe("resourceControlParseOffset", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(parseOffset("-1").isErr()).toBe(true);
    expect(parseOffset(undefined)._unsafeUnwrap()).toBe(0);
  });
});
