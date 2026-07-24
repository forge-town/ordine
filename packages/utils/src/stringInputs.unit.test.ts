import { describe, expect, it } from "vitest";
import { toStringInputs } from "./stringInputs";

describe("toStringInputs", () => {
  it("returns only string values from the config object", () => {
    expect(
      toStringInputs({
        prompt: "daily brief",
        count: 3,
        enabled: true,
        nested: { value: "ignored" },
        empty: null,
      }),
    ).toEqual({ prompt: "daily brief" });
  });

  it("returns an empty object for null or empty input", () => {
    expect(toStringInputs(null)).toEqual({});
    expect(toStringInputs({})).toEqual({});
  });
});
