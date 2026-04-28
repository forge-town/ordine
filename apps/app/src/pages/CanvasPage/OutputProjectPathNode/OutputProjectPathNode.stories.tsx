import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { OutputProjectPathNode } from "./OutputProjectPathNode";

const meta: Meta<typeof OutputProjectPathNode> = {
  title: "CanvasPage/OutputProjectPathNode",
  component: OutputProjectPathNode,
  tags: ["autodocs"],
  args: {
    id: "output-project",
    data: {
      label: "Write Project File",
      nodeType: "output-project-path",
      projectId: "project-ordine",
      path: "docs/review.md",
      description: "Writes the output back into the selected project.",
    },
  },
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <div className="p-6">
            <Story />
          </div>
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: "Output node for writing pipeline artifacts to a project-relative path.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OutputProjectPathNode>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Project-path output node with project id, path, and description.",
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
        story: "Selected project-path output node state.",
      },
    },
  },
};
