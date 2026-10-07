import { describe, expect, it } from "vitest";
import { createDispatcherStartMethod } from "./dispatcherStart.method";
describe("dispatcherStart", () => {
  it("rejects a second start before touching dependencies", async () => {
    const state = { started: true, accepting: false };
    const result = await createDispatcherStartMethod({
      state,
      deps: {} as never,
      poll: () => {},
      pollMs: 100,
    } as never)();
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("DISPATCHER_ALREADY_STARTED");
  });
});
