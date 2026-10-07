import { describe, expect, it, vi } from "vitest";
import { createCancelMethod } from "./cancel.method";

describe("cancel", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const result = { id: "run-1", status: "completed" };
    const requestCancel = vi.fn();
    const cancel = createCancelMethod({
      getRunRecord: vi.fn().mockResolvedValue(result),
      getPublicRun: vi.fn().mockResolvedValue(result),
      runsDao: { requestCancel },
      activeRuns: new Map(),
    } as never);
    expect(await cancel("run-1")).toEqual(result);
    expect(requestCancel).not.toHaveBeenCalled();
  });
});
