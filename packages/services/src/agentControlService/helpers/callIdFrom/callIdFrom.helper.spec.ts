import { describe, expect, it } from "vitest";
import { callIdFrom } from "./callIdFrom.helper";

describe("callIdFrom", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(callIdFrom({ callId: "call-1" })).toBe("call-1");
    expect(callIdFrom({ callId: 7 })).toBeNull();
    expect(callIdFrom(null)).toBeNull();
  });
});
