import { describe, expect, it } from "vitest";
import { derivePhase } from "./derivePhase";
import type { CanvasNode } from "./canvasTypes";

const node: CanvasNode = {
  id: "node-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "File",
    nodeType: "file",
    filePath: "/tmp/file.txt",
  },
};

describe("derivePhase", () => {
  it("returns proposal when a pending proposal exists", () => {
    expect(
      derivePhase({
        activeJob: { status: "running" },
        nodes: [],
        pendingProposal: { actions: [] },
      }),
    ).toBe("proposal");
  });

  it("returns running for an active queued job", () => {
    expect(derivePhase({ activeJob: { status: "queued" }, nodes: [node] })).toBe("running");
  });

  it("returns running for an active running job", () => {
    expect(derivePhase({ activeJob: { status: "running" }, nodes: [node] })).toBe("running");
  });

  it("returns running for an active paused job", () => {
    expect(derivePhase({ activeJob: { status: "paused" }, nodes: [node] })).toBe("running");
  });

  it("returns empty when the graph has no nodes", () => {
    expect(derivePhase({ nodes: [], latestJob: { status: "done" } })).toBe("empty");
  });

  it("returns done when the latest job completed and the graph has not changed", () => {
    expect(
      derivePhase({
        graphDirtySinceLatestJob: false,
        latestJob: { status: "done" },
        nodes: [node],
      }),
    ).toBe("done");
  });

  it("returns applied when a completed graph changed after the latest job", () => {
    expect(
      derivePhase({
        graphDirtySinceLatestJob: true,
        latestJob: { status: "done" },
        nodes: [node],
      }),
    ).toBe("applied");
  });

  it("returns applied for any non-empty graph without a completed clean job", () => {
    expect(derivePhase({ nodes: [node], latestJob: { status: "failed" } })).toBe("applied");
  });
});
