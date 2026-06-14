import { Position, ReactFlowProvider } from "@xyflow/react";
import type { Meta, StoryObj } from "@storybook/react";
import { CanvasStoreProvider } from "../_store/canvasStore";
import { SemanticEdge } from "./SemanticEdge";

const meta: Meta<typeof SemanticEdge> = {
  title: "WorkspacePage/CanvasV2/Edges",
  component: SemanticEdge,
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <CanvasStoreProvider>
          <svg className="h-40 w-80 bg-surface-2">
            <Story />
          </svg>
        </CanvasStoreProvider>
      </ReactFlowProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SemanticEdge>;

export const Semantic: Story = {
  args: {
    data: { label: "document" },
    id: "edge-story",
    selected: true,
    source: "node-a",
    sourcePosition: Position.Right,
    sourceX: 40,
    sourceY: 80,
    target: "node-b",
    targetPosition: Position.Left,
    targetX: 260,
    targetY: 80,
  },
};
