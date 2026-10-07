import { describe, expect, it, vi } from "vitest";
import { createGetChangeSetsMethod } from "./getChangeSets.method";

describe("getChangeSets", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createGetChangeSetsMethod({
        changeSetsDao: { findManyByThreadId: vi.fn().mockResolvedValue([]) },
      } as never)("thread-1"),
    ).toEqual([]);
  });
});
