import { describe, expect, it } from "vitest";
import { createCanvasStore } from "./canvasStore";
import { selectNodeRunState } from "./selectors";

describe("canvas selectors", () => {
  it("returns the selected node run status", () => {
    const store = createCanvasStore();
    store.getState().setNodeRunStatuses({ "node-a": "done" });

    expect(selectNodeRunState("node-a")(store.getState())).toEqual({
      dimmed: false,
      runStatus: "done",
    });
  });

  it("dims inactive nodes while another node is running", () => {
    const store = createCanvasStore();
    store.getState().markNodeRunning("node-a");

    expect(selectNodeRunState("node-b")(store.getState())).toEqual({
      dimmed: true,
      runStatus: undefined,
    });
  });

  it("does not dim a node whose own status is running", () => {
    const store = createCanvasStore();
    store.getState().markNodeRunning("node-a");
    store.getState().setNodeRunStatuses({ "node-b": "running" });

    expect(selectNodeRunState("node-b")(store.getState())).toEqual({
      dimmed: false,
      runStatus: "running",
    });
  });
});
