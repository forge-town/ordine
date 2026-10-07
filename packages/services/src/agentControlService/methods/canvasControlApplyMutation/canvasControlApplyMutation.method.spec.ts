import { describe, expect, it } from "vitest";
import { createCanvasControlApplyMutationMethod } from "./canvasControlApplyMutation.method";

describe("canvasControlApplyMutation", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCanvasControlApplyMutationMethod({} as never)({
      input: { threadId: "other" },
      threadId: "thread-1",
      runId: null,
    } as never);
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "THREAD_BINDING_MISMATCH",
      field: "threadId",
    });
  });
});
