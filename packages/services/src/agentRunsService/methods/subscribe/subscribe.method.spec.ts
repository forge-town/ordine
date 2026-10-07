import { describe, expect, it, vi } from "vitest";
import { createSubscribeMethod } from "./subscribe.method";
import { createBroadcastHelper } from "../../helpers/broadcast";
describe("subscribe", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const listeners = new Map();
    const received = vi.fn();
    const unsubscribe = createSubscribeMethod({ listeners })("run-1", received);
    const broadcast = createBroadcastHelper({ listeners });
    await broadcast({ runId: "run-1" } as never);
    unsubscribe();
    await broadcast({ runId: "run-1" } as never);
    expect(received).toHaveBeenCalledOnce();
  });
});
