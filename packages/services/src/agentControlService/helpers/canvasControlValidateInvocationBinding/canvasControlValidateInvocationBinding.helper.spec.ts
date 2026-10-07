import { describe, expect, it } from "vitest";
import { validateInvocationBinding } from "./canvasControlValidateInvocationBinding.helper";

describe("canvasControlValidateInvocationBinding", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = validateInvocationBinding({
      input: { threadId: "other" } as never,
      threadId: "thread-1",
      runId: null,
      actionId: "action-1",
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "THREAD_BINDING_MISMATCH",
      retryable: false,
      field: "threadId",
    });
  });
});
