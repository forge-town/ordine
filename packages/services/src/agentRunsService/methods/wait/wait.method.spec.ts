import { describe, expect, it, vi } from "vitest";
import { createWaitMethod } from "./wait.method";

describe("wait", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const wait = createWaitMethod({
      executions: new Map(),
      getRunRecord: vi.fn().mockResolvedValue({ status: "running" }),
      getPublicRun: vi.fn(),
    } as never);
    await expect(wait("run-1")).rejects.toThrow("not executing in this service process");
  });
});
