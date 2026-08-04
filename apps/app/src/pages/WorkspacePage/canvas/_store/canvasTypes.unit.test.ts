import { describe, expect, it } from "vitest";
import type { PipelineGraphSnapshot } from "@repo/schemas";
import {
  fromPipelineSnapshot,
  sortParentBeforeChildren,
  toPipelineSnapshot,
  type CanvasNode,
} from "./canvasTypes";

const makeFileNode = (id: string, parentId?: string): CanvasNode => ({
  id,
  type: "file",
  parentId,
  extent: parentId ? "parent" : undefined,
  position: { x: 0, y: 0 },
  data: {
    label: id,
    nodeType: "file",
    filePath: `/tmp/${id}.txt`,
  },
});

describe("canvasTypes", () => {
  it("round-trips a pipeline snapshot without dropping canvas fields", () => {
    const parent = makeFileNode("parent");
    const child = {
      ...makeFileNode("child", "parent"),
      measured: { width: 240, height: 120 },
    };
    const snapshot: PipelineGraphSnapshot = {
      nodes: [child, parent],
      edges: [
        {
          id: "edge-parent-child",
          source: "parent",
          target: "child",
          sourceHandle: "out",
          targetHandle: "in",
          type: "semantic",
          animated: true,
          data: { label: "Parent to child" },
        },
      ],
    };

    const canvas = fromPipelineSnapshot(snapshot);
    const nextSnapshot = toPipelineSnapshot(canvas);

    expect(nextSnapshot.nodes.map((node) => node.id)).toEqual(["parent", "child"]);
    expect(nextSnapshot.nodes.find((node) => node.id === "child")).toEqual(child);
    expect(nextSnapshot.edges).toEqual(snapshot.edges);
  });

  it("sorts every ancestor before its children", () => {
    const unrelated = makeFileNode("unrelated");
    const grandchild = makeFileNode("grandchild", "child");
    const child = makeFileNode("child", "parent");
    const parent = makeFileNode("parent");

    const sorted = sortParentBeforeChildren([unrelated, grandchild, child, parent]);

    expect(sorted.map((node) => node.id)).toEqual(["unrelated", "parent", "child", "grandchild"]);
  });

  it("keeps unrelated nodes in their original order", () => {
    const first = makeFileNode("first");
    const second = makeFileNode("second");
    const third = makeFileNode("third");

    const sorted = sortParentBeforeChildren([first, second, third]);

    expect(sorted).toEqual([first, second, third]);
  });
});
