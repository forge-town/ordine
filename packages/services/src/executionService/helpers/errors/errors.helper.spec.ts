import { describe, expect, it } from "vitest";
import { NodeExecutionResolutionErrorCodeSchema } from "./errors.helper";

describe("errors", () => {
  it("keeps the extracted error code contract parseable", () => {
    expect(NodeExecutionResolutionErrorCodeSchema.safeParse("INVALID_INPUT").success).toBe(true);
    expect(NodeExecutionResolutionErrorCodeSchema.safeParse("unknown").success).toBe(false);
  });
});
