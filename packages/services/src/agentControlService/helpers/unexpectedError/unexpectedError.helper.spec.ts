import { describe, expect, it } from "vitest";
import { unexpectedError } from "./unexpectedError.helper";

describe("unexpectedError", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(unexpectedError(new Error("provider failed"))).toMatchObject({
      retryable: false,
    });
    expect(unexpectedError(new Error("provider failed")).message).toBe("provider failed");
  });
});
