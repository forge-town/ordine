import { describe, expect, it } from "vitest";
import { createRuntimeNotFoundError } from "./createRuntimeNotFoundError.helper";

describe("createRuntimeNotFoundError", () => {
  it("retains the planning and attachment boundary", () => {
    expect(createRuntimeNotFoundError()).toMatchObject({
      code: "PIPELINE_AGENT_RUNTIME_NOT_FOUND",
      message: "No Agent runtime is configured",
    });
    expect(createRuntimeNotFoundError("missing").message).toBe(
      "Configured Agent runtime not found: missing",
    );
  });
});
