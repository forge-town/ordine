import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { ErrorNode } from "./ErrorNode";

const meta: Meta<typeof ErrorNode> = {
  title: "CanvasPage/ErrorNode",
  component: ErrorNode,
  tags: ["autodocs"],
  args: {
    id: "unknown-node",
    type: "legacy-node",
    data: {},
  },
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <div className="p-6">
          <Story />
        </div>
      </ReactFlowProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Fallback node shown when the Canvas receives an unknown or unsupported node type.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ErrorNode>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Unknown-node fallback with type and id visible.",
      },
    },
  },
};

export const Selected: Story = {
  args: {
    selected: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Selected fallback node state.",
      },
    },
  },
};
