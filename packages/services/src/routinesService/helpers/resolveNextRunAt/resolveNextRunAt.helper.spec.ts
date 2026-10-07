import { describe, expect, it } from "vitest";
import { resolveNextRunAt } from "./resolveNextRunAt.helper";
describe("resolveNextRunAt", () => {
  it("has no pending occurrence for a disabled routine", () => {
    expect(resolveNextRunAt(false, "*/5 * * * *")).toBeNull();
  });
  it("has no pending occurrence for a missing or invalid cron", () => {
    expect(resolveNextRunAt(true, null)).toBeNull();
    expect(resolveNextRunAt(true, "bogus")).toBeNull();
  });
});
