import { ReactFlowProvider } from "@xyflow/react";
import type { Meta, StoryObj } from "@storybook/react";
import { CanvasStoreProvider } from "../_store/canvasStore";
import type { CanvasNode } from "../_store/canvasTypes";
import { CanvasFlow } from "./CanvasFlow";

const nodes = [
  {
    data: {
      filePath: "src/source.ts",
      label: "Source file",
      language: "typescript",
      nodeType: "file",
    },
    id: "node-file",
    position: { x: 0, y: 0 },
    type: "file",
  },
  {
    data: {
      config: {},
      label: "Parse PDF",
      nodeType: "operation",
      operationId: "op-parse",
      operationName: "Parse PDF",
      status: "idle",
    },
    id: "node-operation",
    position: { x: 320, y: 0 },
    type: "operation",
  },
] satisfies CanvasNode[];

const meta: Meta<typeof CanvasFlow> = {
  title: "WorkspacePage/CanvasV2/Flow",
  component: CanvasFlow,
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <CanvasStoreProvider
          edges={[
            {
              animated: true,
              data: { label: "document" },
              id: "edge-file-operation",
              source: "node-file",
              target: "node-operation",
              type: "semantic",
            },
          ]}
          nodes={nodes}
        >
          <div className="h-[520px] w-full bg-surface-2">
            <Story />
          </div>
        </CanvasStoreProvider>
      </ReactFlowProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CanvasFlow>;

export const Default: Story = {};
