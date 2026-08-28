import { describe, expect, it } from "vitest";
import { decodeAgentRunEventCursor, encodeAgentRunEventCursor } from "./AgentRunCursor";

describe("Agent Run event cursor", () => {
  it("round-trips a run-scoped cursor without exposing a numeric URL value", () => {
    const cursor = encodeAgentRunEventCursor("run/一", 42);

    expect(cursor).not.toBe("42");
    expect(cursor).not.toContain("42");
    expect(decodeAgentRunEventCursor(cursor)).toEqual({ v: 1, r: "run/一", s: 42 });
  });

  it("rejects malformed cursors", () => {
    expect(() => decodeAgentRunEventCursor("not-a-cursor")).toThrow();
  });
});
