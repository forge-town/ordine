import { describe, expect, it, vi } from "vitest";
import { createRedoChangeSetMethod } from "./redoChangeSet.method";

describe("redoChangeSet", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = { type: "version_mismatch", currentVersion: 3 };
    expect(
      await createRedoChangeSetMethod({
        repository: { compensateChangeSet: vi.fn().mockResolvedValue(result) },
      } as never)("change-1", 2),
    ).toEqual(result);
  });
});
