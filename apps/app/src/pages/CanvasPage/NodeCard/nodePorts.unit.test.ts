import { describe, expect, it } from "vitest";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";
import {
  decorateEdgesWithPortHandles,
  getNodePortCount,
  getNodePortCounts,
  getNodePortOffsets,
  makeNodePortId,
} from "./nodePorts";

const makeNode = (id: string, y: number): PipelineNode =>
  ({
    id,
    type: "operation",
    position: { x: 0, y },
    measured: { width: 288, height: 120 },
    data: { label: id },
  }) as PipelineNode;

const makeEdge = (id: string, source: string, target: string): PipelineEdge =>
  ({
    id,
    source,
    target,
    type: "default",
    animated: true,
    data: {},
  }) as PipelineEdge;

describe("node port helpers", () => {
  it("keeps a center slot for an unconnected side", () => {
    expect(getNodePortCount([], "node-a", "right")).toBe(1);
    expect(getNodePortOffsets(1)).toEqual([0]);
  });

  it("counts a pending connection as the next dynamic port", () => {
    const edge = makeEdge("edge-existing", "source", "target");

    expect(
      getNodePortCount([], "source", "right", {
        nodeId: "source",
        handleId: "right-port-0",
        handleType: "source",
      })
    ).toBe(1);
    expect(
      getNodePortCount([edge], "source", "right", {
        nodeId: "source",
        handleId: "right-port-0",
        handleType: "source",
      })
    ).toBe(2);
    expect(
      getNodePortCount([edge], "source", "left", {
        nodeId: "source",
        handleId: "right-port-0",
        handleType: "source",
      })
    ).toBe(1);
  });

  it("counts both node sides in one helper", () => {
    const edges = [
      makeEdge("edge-in", "upstream", "node"),
      makeEdge("edge-out", "node", "downstream"),
    ];

    expect(
      getNodePortCounts(edges, "node", {
        nodeId: "node",
        handleId: "left-port-0",
        handleType: "target",
      })
    ).toEqual({ leftPortCount: 2, rightPortCount: 1 });
  });

  it("creates predictable split offsets", () => {
    expect(getNodePortOffsets(2)).toEqual([-28, 28]);
    expect(getNodePortOffsets(3)).toEqual([-36, 0, 36]);
    expect(getNodePortOffsets(4)).toEqual([-42, -14, 14, 42]);
    expect(makeNodePortId("left", 2)).toBe("left-port-2");
  });

  it("widens the port spread after four connections", () => {
    expect(getNodePortOffsets(5)).toEqual([-56, -28, 0, 28, 56]);
    expect(getNodePortOffsets(6)).toEqual([-70, -42, -14, 14, 42, 70]);
  });

  it("caps the port spread to the available card half-height", () => {
    expect(getNodePortOffsets(6, 60)).toEqual([-60, -36, -12, 12, 36, 60]);
    expect(getNodePortOffsets(8, 48)).toEqual([-48, -34, -21, -7, 7, 21, 34, 48]);
  });

  it("assigns source handles by target node vertical order", () => {
    const nodes = [makeNode("source", 100), makeNode("low", 240), makeNode("high", 0)];
    const edges = [makeEdge("edge-low", "source", "low"), makeEdge("edge-high", "source", "high")];

    expect(decorateEdgesWithPortHandles(nodes, edges)).toEqual([
      expect.objectContaining({ id: "edge-low", sourceHandle: "right-port-1" }),
      expect.objectContaining({ id: "edge-high", sourceHandle: "right-port-0" }),
    ]);
  });

  it("keeps an explicit source handle and routes automatic handles around it", () => {
    const nodes = [
      makeNode("source", 100),
      makeNode("top", 0),
      makeNode("bottom", 240),
      makeNode("manual", 480),
    ];
    const edges = [
      makeEdge("edge-bottom", "source", "bottom"),
      {
        ...makeEdge("edge-manual", "source", "manual"),
        sourceHandle: "right-port-1",
      },
      makeEdge("edge-top", "source", "top"),
    ];

    expect(decorateEdgesWithPortHandles(nodes, edges)).toEqual([
      expect.objectContaining({ id: "edge-bottom", sourceHandle: "right-port-2" }),
      expect.objectContaining({ id: "edge-manual", sourceHandle: "right-port-1" }),
      expect.objectContaining({ id: "edge-top", sourceHandle: "right-port-0" }),
    ]);
  });

  it("reserves the dragged source handle while a new connection is pending", () => {
    const nodes = [makeNode("source", 100), makeNode("target", 240)];
    const edges = [
      {
        ...makeEdge("edge-existing", "source", "target"),
        sourceHandle: "right-port-0",
      },
    ];

    expect(
      decorateEdgesWithPortHandles(nodes, edges, {
        nodeId: "source",
        handleId: "right-port-0",
        handleType: "source",
      })
    ).toEqual([expect.objectContaining({ id: "edge-existing", sourceHandle: "right-port-1" })]);
  });

  it("assigns target handles by source node vertical order", () => {
    const nodes = [makeNode("target", 100), makeNode("low", 240), makeNode("high", 0)];
    const edges = [makeEdge("edge-low", "low", "target"), makeEdge("edge-high", "high", "target")];

    expect(decorateEdgesWithPortHandles(nodes, edges)).toEqual([
      expect.objectContaining({ id: "edge-low", targetHandle: "left-port-1" }),
      expect.objectContaining({ id: "edge-high", targetHandle: "left-port-0" }),
    ]);
  });

  it("keeps an explicit target handle and routes automatic handles around it", () => {
    const nodes = [
      makeNode("target", 100),
      makeNode("top", 0),
      makeNode("bottom", 240),
      makeNode("manual", 480),
    ];
    const edges = [
      makeEdge("edge-bottom", "bottom", "target"),
      {
        ...makeEdge("edge-manual", "manual", "target"),
        targetHandle: "left-port-1",
      },
      makeEdge("edge-top", "top", "target"),
    ];

    expect(decorateEdgesWithPortHandles(nodes, edges)).toEqual([
      expect.objectContaining({ id: "edge-bottom", targetHandle: "left-port-2" }),
      expect.objectContaining({ id: "edge-manual", targetHandle: "left-port-1" }),
      expect.objectContaining({ id: "edge-top", targetHandle: "left-port-0" }),
    ]);
  });

  it("reserves the dragged target handle while a new upstream connection is pending", () => {
    const nodes = [makeNode("target", 100), makeNode("source", 240)];
    const edges = [
      {
        ...makeEdge("edge-existing", "source", "target"),
        targetHandle: "left-port-0",
      },
    ];

    expect(
      decorateEdgesWithPortHandles(nodes, edges, {
        nodeId: "target",
        handleId: "left-port-0",
        handleType: "target",
      })
    ).toEqual([expect.objectContaining({ id: "edge-existing", targetHandle: "left-port-1" })]);
  });
});
