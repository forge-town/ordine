import { describe, expect, it } from "vitest";
import { formatTimeout } from "./formatTimeout.helper";

describe("formatTimeout", () => {
  it("retains the Agent Run boundary contract", () => {
    expect(formatTimeout(60_000)).toBe("1 minute");
    expect(formatTimeout(45_000)).toBe("45 seconds");
  });
});
