import { describe, expect, it } from "vitest";
import { isCancellationError } from "./isCancellationError.helper";
import { createCancellationError } from "../createCancellationError";
describe("isCancellationError", () => {
  it("retains the planning and attachment boundary", () => {
    expect(isCancellationError(createCancellationError("session"))).toBe(true);
    expect(isCancellationError(new Error("provider failed"))).toBe(false);
  });
});
