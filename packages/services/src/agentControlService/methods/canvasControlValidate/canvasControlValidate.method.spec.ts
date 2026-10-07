import { describe, expect, it, vi } from "vitest";
import { createCanvasControlValidateMethod } from "./canvasControlValidate.method";

describe("canvasControlValidate", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlValidateMethod({
      resolveSnapshot: vi.fn().mockResolvedValue(null),
    } as never)({ pipelineId: "missing", threadId: "thread-1" });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "PIPELINE_NOT_FOUND" });
  });
});
