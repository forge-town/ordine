import { afterEach, describe, expect, it } from "vitest";
import {
  clearProposeProgressStore,
  getProposeProgress,
  setProposeProgress,
} from "./progressStore";

describe("proposeActions progressStore", () => {
  afterEach(() => clearProposeProgressStore());

  it("returns the latest stage for a token and null for unknown tokens", () => {
    setProposeProgress("token-1", "thinking");
    setProposeProgress("token-1", "drafting");

    expect(getProposeProgress("token-1")).toBe("drafting");
    expect(getProposeProgress("token-2")).toBeNull();
  });

  it("tracks tokens independently", () => {
    setProposeProgress("a", "analyzing");
    setProposeProgress("b", "validating");

    expect(getProposeProgress("a")).toBe("analyzing");
    expect(getProposeProgress("b")).toBe("validating");
  });
});
