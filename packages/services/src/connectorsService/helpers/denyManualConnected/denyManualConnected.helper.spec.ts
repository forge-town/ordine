import { describe, expect, it } from "vitest";
import { denyManualConnected } from "./denyManualConnected.helper";
describe("denyManualConnected", () => {
  it("preserves an unchanged non-connected payload reference", () => {
    const input = { status: "error", name: "Local" };
    expect(denyManualConnected(input)).toBe(input);
  });
  it("downgrades a forged connected status without mutating the input", () => {
    const input = { status: "connected", name: "Local" };
    expect(denyManualConnected(input)).toEqual({ status: "needs_setup", name: "Local" });
    expect(input.status).toBe("connected");
  });
});
