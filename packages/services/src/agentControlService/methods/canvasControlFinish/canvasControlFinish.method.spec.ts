import { describe, expect, it, vi } from "vitest";
import { createCanvasControlFinishMethod } from "./canvasControlFinish.method";

describe("canvasControlFinish", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlFinishMethod({
      resolveSnapshot: vi.fn().mockResolvedValue(null),
    } as never)({
      pipelineId: "missing",
      threadId: "thread-1",
      expectedVersion: 1,
      actionId: "action-1",
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "CHANGE_SET_NOT_FOUND" });
  });
});
