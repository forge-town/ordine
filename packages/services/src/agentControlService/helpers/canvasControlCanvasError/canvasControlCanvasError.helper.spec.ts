import { describe, expect, it } from "vitest";
import { canvasError } from "./canvasControlCanvasError.helper";

describe("canvasControlCanvasError", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(
      canvasError("action-1", "STALE", "Changed", true, { field: "expectedVersion" }),
    ).toMatchObject({
      actionId: "action-1",
      code: "STALE",
      retryable: true,
      field: "expectedVersion",
    });
  });
});
