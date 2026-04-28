import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
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
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <div className="h-48 w-80 p-4">
            <Story />
          </div>
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Compound node frame used to group related Canvas nodes. Docs stories check selected and child-count states.",
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
        story: "Group frame with two child nodes.",
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
        story: "Selected group frame state.",
      },
    },
  },
};
