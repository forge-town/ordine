import { describe, expect, it, vi } from "vitest";
import { createApplyChangeSetMethod } from "./applyChangeSet.method";

describe("applyChangeSet", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = { type: "version_mismatch", currentVersion: 3 };
    const apply = createApplyChangeSetMethod({
      repository: { applyChangeSet: vi.fn().mockResolvedValue(result) },
    } as never);
    expect(await apply("change-1", 2)).toEqual(result);
  });
});
