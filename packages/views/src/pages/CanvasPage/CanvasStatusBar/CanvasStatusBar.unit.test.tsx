import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { CanvasStatusBar } from "./CanvasStatusBar";

const node = {
  id: "node-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
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
    const store = createCanvasPageStore([node], [edge]);
    store.setState({ selectedNodeId: "node-1", viewportZoom: 1.25 });

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <CanvasStatusBar />
      </CanvasPageStoreContext.Provider>,
    );

    expect(screen.getByText(/1 (nodes|个节点)/)).toBeInTheDocument();
    expect(screen.getByText(/1 (edges|条连线)/)).toBeInTheDocument();
    expect(screen.getByText(/(Zoom|缩放) 125%/)).toBeInTheDocument();
    expect(screen.getByText(/(Selected|选中) Source File/)).toBeInTheDocument();
  });
});
