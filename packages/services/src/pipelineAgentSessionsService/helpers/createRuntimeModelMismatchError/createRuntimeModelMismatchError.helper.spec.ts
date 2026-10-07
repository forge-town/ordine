import { describe, expect, it } from "vitest";
import { createRuntimeModelMismatchError } from "./createRuntimeModelMismatchError.helper";

describe("createRuntimeModelMismatchError", () => {
  it("retains the planning and attachment boundary", () => {
    expect(createRuntimeModelMismatchError("runtime-1", "other-model")).toMatchObject({
      code: "PIPELINE_AGENT_RUNTIME_MODEL_MISMATCH",
      message: "Configured model other-model is not available for Agent runtime runtime-1",
    });
  });
});
