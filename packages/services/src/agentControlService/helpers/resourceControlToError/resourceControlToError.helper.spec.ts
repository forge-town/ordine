import { describe, expect, it } from "vitest";
import { toError } from "./resourceControlToError.helper";

describe("resourceControlToError", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(toError(new Error("Changed"), "Update")).toMatchObject({
      code: "RESOURCE_OPERATION_FAILED",
      message: "Changed",
    });
  });
});
