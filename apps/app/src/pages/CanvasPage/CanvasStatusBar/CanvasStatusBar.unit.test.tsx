import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
import { CanvasStatusBar } from "./CanvasStatusBar";

const node = {
  id: "node-1",
  type: "code-file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "code-file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "",
  },
} as PipelineNode;

const edge = {
  id: "edge-1",
  source: "node-1",
  target: "node-2",
  data: {},
} as PipelineEdge;

describe("CanvasStatusBar", () => {
  it("shows node count, edge count, zoom, and selected node label", () => {
    const store = createHarnessCanvasStore([node], [edge]);
    store.setState({ selectedNodeId: "node-1", viewportZoom: 1.25 });

    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <CanvasStatusBar />
      </HarnessCanvasStoreContext.Provider>
    );

    expect(screen.getByText(/1 (nodes|个节点)/)).toBeInTheDocument();
    expect(screen.getByText(/1 (edges|条连线)/)).toBeInTheDocument();
    expect(screen.getByText(/(Zoom|缩放) 125%/)).toBeInTheDocument();
    expect(screen.getByText(/(Selected|选中) Source File/)).toBeInTheDocument();
  });
});
