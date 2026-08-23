import { describe, expect, it } from "vitest";
import { createCanvasPageStore } from "./canvasPageStore";

describe("canvas runtime event projection", () => {
  it("uses one reducer for replayed text, tools, usage, and authoritative terminal output", () => {
    const store = createCanvasPageStore();
    const timestamp = "2026-08-24T00:00:00.000Z";
    store.getState().registerNodeAgentRun("node-1", "run-1");
    store.getState().registerNodeAgentRun("node-1", "run-1");
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "message",
      runtime: "codex",
      timestamp,
      text: "Hello",
    });
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "text_delta",
      runtime: "codex",
      timestamp,
      text: " world",
    });
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "tool_start",
      runtime: "codex",
      timestamp,
      id: "tool-1",
      name: "Read",
    });
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "tool_result",
      runtime: "codex",
      timestamp,
      id: "tool-1",
      output: "ok",
      isError: false,
    });
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "usage",
      runtime: "codex",
      timestamp,
      inputTokens: 4,
      outputTokens: 2,
    });
    store.getState().applyNodeRuntimeEvent("node-1", "run-1", {
      type: "terminal",
      runtime: "codex",
      timestamp,
      status: "completed",
      resultText: "Final answer",
    });

    const state = store.getState();
    expect(state.nodeAgentRunIds).toEqual({ "node-1": ["run-1"] });
    expect(state.nodeLlmContent["node-1"]).toBe("Final answer");
    expect(state.nodeAgentActivities["node-1"]?.map((entry) => entry.kind)).toEqual([
      "tool",
      "usage",
      "terminal",
    ]);
    expect(state.nodeAgentActivities["node-1"]?.[0]).toMatchObject({
      id: "run-1:tool-tool-1",
      title: "tool-1 · completed",
    });
  });

  it("opens a completed node as soon as its persisted run is registered", () => {
    const store = createCanvasPageStore();
    store.getState().registerNodeAgentRun("node-1", "run-1");

    store.getState().handleOperationCardClick("node-1");

    expect(store.getState().inspectingNodeId).toBe("node-1");
  });
});
