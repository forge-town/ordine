import { describe, expect, it } from "vitest";
import { labelFor } from "./resourceControlLabelFor.helper";

describe("resourceControlLabelFor", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(labelFor({ title: "Brief" })).toBe("Brief");
    expect(labelFor({ name: 7 })).toBeUndefined();
  });
});
