import { describe, expect, it } from "vitest";
import { parseCanvasRunTraceEvents } from "./canvasRunTraceEvents";

describe("parseCanvasRunTraceEvents", () => {
  it("keeps node/run mapping and legacy activity while preserving delimiter text", () => {
    const events = parseCanvasRunTraceEvents([
      "[2026-08-24T00:00:00.000Z] @@NODE_START::node-1",
      "@@AGENT_RUN::node-1::run-1",
      "@@LLM_CONTENT::node-1::first::second",
      '@@AGENT_EVENT::node-legacy::{"type":"usage","runtime":"codex","timestamp":"2026-08-24T00:00:01.000Z","inputTokens":2}',
      "@@AGENT_EVENT::node-legacy::{broken",
      "@@NODE_DONE::node-1",
    ]);

    expect(events).toEqual([
      { type: "node_start", nodeId: "node-1" },
      { type: "agent_run", nodeId: "node-1", runId: "run-1" },
      { type: "llm_content", nodeId: "node-1", content: "first::second" },
      {
        type: "agent_event",
        nodeId: "node-legacy",
        event: {
          type: "usage",
          runtime: "codex",
          timestamp: "2026-08-24T00:00:01.000Z",
          inputTokens: 2,
        },
      },
      { type: "node_done", nodeId: "node-1" },
    ]);
  });
});
