import { describe, expect, it, vi } from "vitest";
import type { ClaudeStreamEvent } from "@repo/agent";

vi.mock("@repo/obs", () => ({ recordAgentRunWithSpans: vi.fn() }));
vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { extractTokenTotals } from "./observability";

const resultEvent = (
  modelUsage?: Record<string, { inputTokens?: number; outputTokens?: number }>,
): ClaudeStreamEvent => ({
  type: "result",
  subtype: "success",
  duration_ms: 1,
  total_cost_usd: 0,
  num_turns: 1,
  ...(modelUsage ? { modelUsage } : {}),
});

describe("extractTokenTotals", () => {
  it("returns null when there is no result event", () => {
    expect(extractTokenTotals([])).toBeNull();
  });

  it("returns null when the result event carries no modelUsage (unavailable, not zero)", () => {
    expect(extractTokenTotals([resultEvent()])).toBeNull();
  });

  it("returns null for an empty modelUsage map (no model reported → unavailable, not 0)", () => {
    expect(extractTokenTotals([resultEvent({})])).toBeNull();
  });

  it("sums reported usage across models", () => {
    expect(
      extractTokenTotals([
        resultEvent({
          a: { inputTokens: 10, outputTokens: 4 },
          b: { inputTokens: 1, outputTokens: 2 },
        }),
      ]),
    ).toEqual({ input: 11, output: 6 });
  });

  it("preserves an explicitly reported zero (distinct from unavailable null)", () => {
    expect(extractTokenTotals([resultEvent({ a: { inputTokens: 0, outputTokens: 0 } })])).toEqual({
      input: 0,
      output: 0,
    });
  });
});
