import { describe, expect, it } from "vitest";
import { failure } from "./executionPreflightFailure.helper";

describe("executionPreflightFailure", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(failure("INVALID", "Invalid operation", true, "operationId")).toMatchObject({
      code: "INVALID",
      message: "Invalid operation",
      retryable: true,
      field: "operationId",
    });
  });
});
