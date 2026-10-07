import { describe, expect, it, vi } from "vitest";
import { createAppendControlEventMethod } from "./appendControlEvent.method";

describe("appendControlEvent", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const append = createAppendControlEventMethod({
      getRunRecord: vi.fn().mockResolvedValue({ controlMode: false }),
      persistEvent: vi.fn(),
    } as never);
    await expect(append("run-1", {} as never)).rejects.toThrow("not an Agent Control run");
  });
});
