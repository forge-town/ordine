import { describe, expect, it } from "vitest";
import { toError } from "./toError.helper";

describe("toError", () => {
  it("retains the Agent Run boundary contract", () => {
    const cause = new Error("failure");
    expect(toError(cause)).toBe(cause);
    expect(toError("provider failed").message).toBe("provider failed");
  });
});
