import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineEdge, PipelineNode } from "../_store";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store";
import { CanvasStatusBar } from "./CanvasStatusBar";

const sourceNode = {
  id: "source-file",
  type: "code-file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "code-file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "Pipeline source",
  },
} as PipelineNode;

const reviewNode = {
  id: "review-op",
  type: "operation",
  position: { x: 320, y: 0 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "idle",
    config: {},
  },
} as PipelineNode;

const edge = {
  id: "source-to-review",
  source: "source-file",
  target: "review-op",
  data: {},
} as PipelineEdge;

const renderStatusBar = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  selectedNodeId: string | null,
  viewportZoom: number
) => {
  const store = createHarnessCanvasStore(nodes, edges);
  store.setState({ selectedNodeId, viewportZoom });

  return (
    <HarnessCanvasStoreContext.Provider value={store}>
      <div className="relative h-24 w-full bg-slate-50">
        <CanvasStatusBar />
      </div>
    </HarnessCanvasStoreContext.Provider>
  );
};

const meta: Meta<typeof CanvasStatusBar> = {
  title: "CanvasPage/CanvasStatusBar",
  component: CanvasStatusBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Small canvas state readout pinned to the bottom of the canvas. It shows node count, edge count, current zoom, and the selected node label.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasStatusBar>;

export const EmptyCanvas: Story = {
  render: () => renderStatusBar([], [], null, 1.25),
  parameters: {
    docs: {
      description: {
        story: "Empty-canvas state at the default 125% zoom.",
      },
    },
  },
};

export const WithSelection: Story = {
  render: () => renderStatusBar([sourceNode, reviewNode], [edge], "source-file", 0.8),
  parameters: {
    docs: {
      description: {
        story: "Connected canvas state with one selected node and a non-default zoom value.",
      },
    },
  },
};
