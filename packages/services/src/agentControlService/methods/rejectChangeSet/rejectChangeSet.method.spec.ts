import { describe, expect, it, vi } from "vitest";
import { createRejectChangeSetMethod } from "./rejectChangeSet.method";

describe("rejectChangeSet", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createRejectChangeSetMethod({
        repository: { rejectChangeSet: vi.fn().mockResolvedValue(null) },
      } as never)("missing"),
    ).toBeNull();
  });
});
