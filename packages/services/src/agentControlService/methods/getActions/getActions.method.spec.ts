import { describe, expect, it, vi } from "vitest";
import { createGetActionsMethod } from "./getActions.method";

describe("getActions", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createGetActionsMethod({
        actionsDao: { findManyByThreadId: vi.fn().mockResolvedValue([]) },
      } as never)("thread-1"),
    ).toEqual([]);
  });
});
