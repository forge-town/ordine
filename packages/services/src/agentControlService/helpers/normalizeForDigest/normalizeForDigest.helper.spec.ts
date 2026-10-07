import { describe, expect, it } from "vitest";
import { normalizeForDigest } from "./normalizeForDigest.helper";

describe("normalizeForDigest", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(normalizeForDigest({ b: 2, a: 1, callId: "retry" })).toEqual(
      normalizeForDigest({ a: 1, b: 2, callId: "other" }),
    );
  });
});
