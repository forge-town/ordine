import { describe, expect, it } from "vitest";
import { navigationPath } from "./navigationPath.helper";

describe("navigationPath", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(navigationPath({ type: "pipeline", id: "folder/name" })).toBe(
      "/pipelines/folder%2Fname",
    );
    expect(navigationPath({ type: "operation", id: "operation-1" })).toBe(
      "/pipelines/operations/operation-1",
    );
  });
});
