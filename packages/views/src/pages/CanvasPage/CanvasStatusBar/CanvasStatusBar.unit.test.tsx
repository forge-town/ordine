import { render } from "../../../test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("opens Alan's complete state legend and keeps the current summary in its footer", async () => {
    const user = userEvent.setup();
    const store = createCanvasPageStore([node], [edge]);
    store.setState({ selectedNodeId: "node-1", viewportZoom: 1.25 });

    render(
      <CanvasPageStoreContext.Provider value={store}>
        <CanvasStatusBar />
      </CanvasPageStoreContext.Provider>,
    );

    expect(screen.getByTestId("canvas-v2-state-legend-trigger")).toHaveClass(
      "rounded-full",
      "shadow-soft",
      "ring-1",
      "max-[480px]:px-2",
    );
    expect(screen.getByTestId("canvas-v2-state-legend-trigger").querySelector("span")).toHaveClass(
      "max-[480px]:sr-only",
    );
    expect(screen.queryByTestId("canvas-status-bar")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("canvas-v2-state-legend-trigger"));

    expect(screen.getByTestId("canvas-v2-state-legend")).toBeInTheDocument();
    expect(screen.getByText(/Idle|空闲/)).toBeInTheDocument();
    expect(screen.getByText(/Queued|排队中/)).toBeInTheDocument();
    expect(screen.getByText(/Running|运行中/)).toBeInTheDocument();
    expect(screen.getByText(/Retrying|重试中/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for user|Awaiting you|等待确认/)).toBeInTheDocument();
    expect(screen.getByText(/Done|完成/)).toBeInTheDocument();
    expect(screen.getByText(/Failed|失败/)).toBeInTheDocument();
    expect(screen.getByText(/Skipped|已跳过/)).toBeInTheDocument();
    expect(screen.getByText(/Cancelled|已取消/)).toBeInTheDocument();
    expect(screen.getByTestId("canvas-status-bar")).toBeInTheDocument();
    expect(screen.getByText(/1 (nodes|个节点)/)).toBeInTheDocument();
    expect(screen.getByText(/1 (edges|条连线)/)).toBeInTheDocument();
    expect(screen.getByText(/(Zoom|缩放) 125%/)).toBeInTheDocument();
    expect(screen.getByText(/(Selected|选中) Source File/)).toBeInTheDocument();
  });
});
