import { describe, expect, it } from "vitest";
import { resolveSchedule } from "./resolveSchedule.helper";
describe("resolveSchedule", () => {
  it("accepts a disabled routine without a cron", () => {
    const result = resolveSchedule(false, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBeNull();
  });
  it("rejects an enabled routine without a computable cron", () => {
    const result = resolveSchedule(true, "bogus");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toBe(
      "An enabled routine requires a valid cronExpression",
    );
  });
});
