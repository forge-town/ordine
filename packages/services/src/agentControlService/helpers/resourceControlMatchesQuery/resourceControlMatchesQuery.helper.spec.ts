import { describe, expect, it } from "vitest";
import { matchesQuery } from "./resourceControlMatchesQuery.helper";

describe("resourceControlMatchesQuery", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(matchesQuery({ name: "Code Review", description: "Repository" }, "review")).toBe(true);
    expect(matchesQuery({ name: "Code Review" }, "missing")).toBe(false);
  });
});
