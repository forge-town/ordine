import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCost, formatDurationBetween, formatDurationMs, formatTokens, timeAgo } from "./format";

describe("formatDurationMs", () => {
  it("formats the three magnitude bands consistently", () => {
    expect(formatDurationMs(320)).toBe("320ms");
    expect(formatDurationMs(41_300)).toBe("41.3s");
    expect(formatDurationMs(62_000)).toBe("1m02s");
  });

  it("falls back on empty input and clamps negatives", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(undefined, "-")).toBe("-");
    expect(formatDurationMs(-50)).toBe("0ms");
  });
});

describe("formatDurationBetween", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses now as the open end for running jobs", () => {
    vi.setSystemTime(new Date("2026-06-12T00:01:00Z"));
    expect(formatDurationBetween("2026-06-12T00:00:00Z")).toBe("1m00s");
  });

  it("accepts mixed Date/string/number inputs and falls back without a start", () => {
    expect(formatDurationBetween(1000, new Date(42_000))).toBe("41.0s");
    expect(formatDurationBetween(null)).toBe("—");
  });
});

describe("formatCost", () => {
  it("formats positive numeric and string inputs", () => {
    expect(formatCost(0.31)).toBe("$0.31");
    expect(formatCost("2.5")).toBe("$2.50");
  });

  it("returns null for zero, negative, and invalid inputs", () => {
    expect(formatCost(0)).toBeNull();
    expect(formatCost(null)).toBeNull();
    expect(formatCost("abc")).toBeNull();
  });
});

describe("formatTokens", () => {
  it("renders pairs and the double-empty fallback", () => {
    expect(formatTokens(1200, 480)).toBe("1200 → 480");
    expect(formatTokens(null, 480)).toBe("0 → 480");
    expect(formatTokens(null, null)).toBe("—");
  });
});

describe("timeAgo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders compact buckets", () => {
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
    expect(timeAgo(new Date("2026-06-12T11:59:58Z"))).toBe("now");
    expect(timeAgo("2026-06-12T11:59:15Z")).toBe("45s");
    expect(timeAgo("2026-06-12T11:55:00Z")).toBe("5m");
    expect(timeAgo("2026-06-12T09:00:00Z")).toBe("3h");
    expect(timeAgo("2026-06-10T12:00:00Z")).toBe("2d");
    expect(timeAgo(null)).toBe("—");
  });
});
