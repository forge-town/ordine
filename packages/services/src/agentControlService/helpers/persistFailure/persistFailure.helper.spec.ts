import { describe, expect, it, vi } from "vitest";
import { createPersistFailureHelper } from "./persistFailure.helper";

describe("persistFailure", () => {
  it("retains the Agent Control contract boundary", async () => {
    const updates: unknown[] = [];
    const result = await createPersistFailureHelper({
      actionsDao: {
        update: async (_id: string, patch: unknown) => {
          updates.push(patch);
        },
      },
      emit: vi.fn().mockResolvedValue(undefined),
    } as never)({
      actionId: "action-1",
      toolName: "ordine.search",
      runId: null,
      error: { code: "FAILED", message: "Failed", retryable: true },
    });
    expect(result).toMatchObject({
      actionId: "action-1",
      status: "failed",
      retry: { code: "FAILED" },
    });
    expect(updates[0]).toMatchObject({ status: "failed", result });
  });
});
