import type { Meta, StoryObj } from "@storybook/react";
import type { PipelineEdgeData } from "@repo/schemas";
import {
  CanvasPageStoreContext,
  createCanvasPageStore,
  type PipelineEdge,
  type PipelineNode,
} from "../_store";
import { CanvasEdgeInspector } from "./CanvasEdgeInspector";

const sourceNode = {
  data: {
    description: "Pipeline source",
    filePath: "src/index.ts",
    label: "Source File",
    language: "typescript",
    nodeType: "file",
  },
  id: "source-file",
  position: { x: 80, y: 120 },
  type: "file",
} as PipelineNode;

const targetNode = {
  data: {
    config: {},
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "idle",
  },
  id: "review-op",
  position: { x: 420, y: 120 },
  type: "operation",
} as PipelineNode;

const renderInspector = (data: PipelineEdgeData) => {
  const edge = {
    data,
    id: "source-to-review",
    source: sourceNode.id,
    target: targetNode.id,
  } as PipelineEdge;
  const store = createCanvasPageStore([sourceNode, targetNode], [edge]);
  store.setState({ selectedEdgeId: edge.id });

  return (
    <CanvasPageStoreContext.Provider value={store}>
      <div className="relative h-[620px] w-full bg-canvas-bg">
        <CanvasEdgeInspector />
      </div>
    </CanvasPageStoreContext.Provider>
  );
};

const meta: Meta<typeof CanvasEdgeInspector> = {
  component: CanvasEdgeInspector,
  parameters: {
    docs: {
      description: {
        component:
          "Alan-style edge inspector driven exclusively by the current develop selectedEdgeId, PipelineEdgeData, and updateEdgeData contract.",
      },
    },
  },
  tags: ["autodocs"],
  title: "CanvasPage/CanvasEdgeInspector",
};

export default meta;
type Story = StoryObj<typeof CanvasEdgeInspector>;

export const RuntimeInferred: Story = {
  render: () => renderInspector({ label: "source" }),
};

export const MappedAndGated: Story = {
  render: () =>
    renderInspector({
      condition: { expression: 'content.includes("approved")' },
      dataContract: {
        mappings: [
          { enabled: true, fromField: "content", toInput: "source", type: "string" },
          { enabled: false, fromField: "metadata", toInput: "context", type: "object" },
        ],
      },
      label: "review payload",
      qualityGate: { criteria: "non-empty", maxRetries: 2, onFail: "retry" },
      transform: { steps: [{ config: {}, type: "trim" }] },
    }),
};
