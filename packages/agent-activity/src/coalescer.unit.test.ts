import { describe, expect, it } from "vitest";
import type { RuntimeEvent } from "@repo/schemas";
import { createAgentRunEventCoalescer } from "./coalescer";

const delta = (text: string): RuntimeEvent => ({
  type: "text_delta",
  runtime: "codex",
  timestamp: "2026-08-27T00:00:00.000Z",
  text,
});

describe("Agent Run event coalescer", () => {
  it("merges adjacent deltas and flushes before a tool event", async () => {
    const emitted: Array<{ event: RuntimeEvent; coalesced: boolean }> = [];
    const coalescer = createAgentRunEventCoalescer(
      async (event, meta) => {
        emitted.push({ event, coalesced: meta.coalesced });
      },
      { flushIntervalMs: 60_000, maxFlushIntervalMs: 60_000 },
    );

    await coalescer.push(delta("你"));
    await coalescer.push(delta("好"));
    await coalescer.push({
      type: "tool_start",
      runtime: "codex",
      timestamp: "2026-08-27T00:00:01.000Z",
      id: "tool-1",
      name: "Read",
    });

    expect(emitted.map(({ event }) => event.type)).toEqual(["text_delta", "tool_start"]);
    expect(emitted[0]?.event).toMatchObject({ type: "text_delta", text: "你好" });
    expect(emitted[0]?.coalesced).toBe(true);
  });

  it("splits a delta at the UTF-8 byte threshold", async () => {
    const emitted: RuntimeEvent[] = [];
    const coalescer = createAgentRunEventCoalescer(
      async (event) => {
        emitted.push(event);
      },
      { flushIntervalMs: 60_000, maxFlushIntervalMs: 60_000, maxBytes: 6 },
    );

    await coalescer.push(delta("你好世界"));
    await coalescer.flush();

    expect(emitted).toHaveLength(2);
    expect(emitted.map((event) => event.type)).toEqual(["text_delta", "text_delta"]);
    expect(emitted.map((event) => (event.type === "text_delta" ? event.text : ""))).toEqual([
      "你好",
      "世界",
    ]);
  });
});
