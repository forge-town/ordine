import { describe, expect, it } from "vitest";
import { domainError } from "./resourceControlDomainError.helper";

describe("resourceControlDomainError", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(domainError("NOT_FOUND", "Missing", true, "id")).toMatchObject({
      code: "NOT_FOUND",
      message: "Missing",
      retryable: true,
      field: "id",
    });
  });
});
