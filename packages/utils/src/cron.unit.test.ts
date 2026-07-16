import { describe, expect, it } from "vitest";
import { getNextCronRunAt, isValidCronExpression } from "./cron";

describe("getNextCronRunAt", () => {
  it("computes the next run time for step expressions", () => {
    expect(
      getNextCronRunAt("*/15 * * * *", new Date("2026-06-10T09:07:20.000Z"))?.toISOString(),
    ).toBe("2026-06-10T09:15:00.000Z");
  });

  it("returns a strictly future minute even when called on an exact match", () => {
    expect(
      getNextCronRunAt("*/15 * * * *", new Date("2026-06-10T09:15:00.000Z"))?.toISOString(),
    ).toBe("2026-06-10T09:30:00.000Z");
  });

  // Weekday ranges must parse; the "Weekday 09:00" preset emits `0 9 * * 1-5`.
  // Assertions are timezone-independent: membership is checked via the same
  // local getters the parser uses.
  it("parses weekday ranges (0 9 * * 1-5)", () => {
    const next = getNextCronRunAt("0 9 * * 1-5", new Date("2026-06-12T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(9);
    expect(next!.getMinutes()).toBe(0);
    expect([1, 2, 3, 4, 5]).toContain(next!.getDay());
  });

  it("parses weekday lists (0 9 * * 1,3,5)", () => {
    const next = getNextCronRunAt("0 9 * * 1,3,5", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect([1, 3, 5]).toContain(next!.getDay());
  });

  it("parses range-with-step (0 0-10/2 * * *)", () => {
    const next = getNextCronRunAt("0 0-10/2 * * *", new Date("2026-06-10T03:30:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBeLessThanOrEqual(10);
    expect(next!.getHours() % 2).toBe(0);
  });

  it("parses mixed comma segments (0-2,4 9 * * *)", () => {
    const next = getNextCronRunAt("0-2,4 9 * * *", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect([0, 1, 2, 4]).toContain(next!.getMinutes());
    expect(next!.getHours()).toBe(9);
  });

  it("normalizes Sunday=7 to 0 (0 9 * * 7)", () => {
    const next = getNextCronRunAt("0 9 * * 7", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect(next!.getDay()).toBe(0);
  });

  it("normalizes Sunday=7 inside ranges (0 9 * * 5-7)", () => {
    const next = getNextCronRunAt("0 9 * * 5-7", new Date("2026-06-10T10:00:00.000Z"));
    expect(next).not.toBeNull();
    expect([5, 6, 0]).toContain(next!.getDay());
  });

  it("returns null for out-of-range or malformed fields", () => {
    expect(getNextCronRunAt("0 9 * * 6-8", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 9 * * 1-", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("0 99 * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("*/0 * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("5-2 * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("1,x * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("* * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt("* * * * * *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
    expect(getNextCronRunAt(null, new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
  });

  it("returns null for well-formed but unsatisfiable dates (0 0 30 2 *)", () => {
    expect(getNextCronRunAt("0 0 30 2 *", new Date("2026-06-10T10:00:00.000Z"))).toBeNull();
  });
});

describe("isValidCronExpression", () => {
  it("accepts expressions with a computable next occurrence", () => {
    expect(isValidCronExpression("0 9 * * 1-5")).toBe(true);
    expect(isValidCronExpression("0 9 * * 7")).toBe(true);
    expect(isValidCronExpression("*/5 * * * *")).toBe(true);
  });

  it("rejects malformed and unsatisfiable expressions", () => {
    expect(isValidCronExpression("*/0 * * * *")).toBe(false);
    expect(isValidCronExpression("* * * * * *")).toBe(false);
    expect(isValidCronExpression("0 0 30 2 *")).toBe(false);
    expect(isValidCronExpression("not a cron")).toBe(false);
  });
});
