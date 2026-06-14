import { describe, expect, it } from "vitest";
import { cronOccurrencesForDay } from "./cronOccurrences";

const wednesday = new Date("2026-06-10T00:00:00");

describe("cronOccurrencesForDay", () => {
  it("expands a daily cron to one occurrence", () => {
    const occurrences = cronOccurrencesForDay("0 6 * * *", wednesday);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.getHours()).toBe(6);
    expect(occurrences[0]?.getMinutes()).toBe(0);
  });

  it("expands an hourly cron to 24 occurrences", () => {
    expect(cronOccurrencesForDay("0 * * * *", wednesday)).toHaveLength(24);
  });

  it("respects weekday ranges", () => {
    const sunday = new Date("2026-06-14T00:00:00");

    expect(cronOccurrencesForDay("0 9 * * 1-5", wednesday)).toHaveLength(1);
    expect(cronOccurrencesForDay("0 9 * * 1-5", sunday)).toHaveLength(0);
  });

  it("returns nothing for malformed expressions", () => {
    expect(cronOccurrencesForDay("not a cron", wednesday)).toHaveLength(0);
    expect(cronOccurrencesForDay("x 6 * * *", wednesday)).toHaveLength(0);
  });
});
