import { describe, expect, it, vi } from "vitest";
import { createCanvasControlInspectMethod } from "./canvasControlInspect.method";

describe("canvasControlInspect", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlInspectMethod({
      resolveSnapshot: vi.fn().mockResolvedValue(null),
    } as never)({ pipelineId: "missing", limit: 10 });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "PIPELINE_NOT_FOUND" });
  });
});
