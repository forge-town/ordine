import { describe, expect, it, vi } from "vitest";
import { createRevertChangeSetMethod } from "./revertChangeSet.method";

describe("revertChangeSet", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = { type: "version_mismatch", currentVersion: 3 };
    expect(
      await createRevertChangeSetMethod({
        repository: { compensateChangeSet: vi.fn().mockResolvedValue(result) },
      } as never)("change-1", 2),
    ).toEqual(result);
  });
});
