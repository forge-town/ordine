import { describe, expect, it } from "vitest";
import { createCancellationError } from "./createCancellationError.helper";

describe("createCancellationError", () => {
  it("retains the planning and attachment boundary", () => {
    expect(createCancellationError("session-1")).toMatchObject({
      code: "PIPELINE_AGENT_CANCELLED",
      message: "Pipeline agent session cancelled: session-1",
    });
  });
});
