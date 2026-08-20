import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasPageStoreProvider } from "../_store";
import { CompoundNode } from "./CompoundNode";

const meta: Meta<typeof CompoundNode> = {
  title: "CanvasPage/CompoundNode",
  component: CompoundNode,
  tags: ["autodocs"],
  args: {
    id: "group-1",
    data: {
      label: "Review Group",
      nodeType: "compound",
      childNodeIds: ["source-file", "review-op"],
    },
  },
  decorators: [
    (Story) => (
      <CanvasPageStoreProvider>
        <ReactFlowProvider>
          <div className="h-48 w-80 p-4">
            <Story />
          </div>
        </ReactFlowProvider>
      </CanvasPageStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Variable-size compound parent frame with Alan's neutral node surface, editable label, child count, and edge ports.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CompoundNode>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Neutral variable-size group frame with two child nodes.",
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
        story: "Selected group frame with the neutral selection ring.",
      },
    },
  },
};
