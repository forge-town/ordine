import { describe, expect, it } from "vitest";
import { createSerializeRunPersistenceHelper } from "./serializeRunPersistence.helper";

describe("serializeRunPersistence", () => {
  it("retains the Agent Run boundary contract", async () => {
    const queues = new Map<string, Promise<unknown>>();
    const persist = createSerializeRunPersistenceHelper({ eventPersistenceQueues: queues });
    const order: string[] = [];
    const gateState = { release: () => {} };
    const gate = new Promise<void>((resolve) => {
      gateState.release = resolve;
    });
    const first = persist("run-1", async () => {
      order.push("first");
      await gate;
    });
    const second = persist("run-1", async () => {
      order.push("second");
    });
    await Promise.resolve();
    expect(order).toEqual(["first"]);
    gateState.release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
  });
});
