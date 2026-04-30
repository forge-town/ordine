import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { OutputLocalPathNode } from "./OutputLocalPathNode";

const meta: Meta<typeof OutputLocalPathNode> = {
  title: "CanvasPage/OutputLocalPathNode",
  component: OutputLocalPathNode,
  tags: ["autodocs"],
  args: {
    id: "output-local",
    data: {
      label: "Write Local Report",
      nodeType: "output-local-path",
      localPath: "/workspace/ordine/output",
      outputFileName: "review.md",
      outputMode: "overwrite",
      description: "Writes the review result to a local markdown file.",
    },
  },
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <HarnessCanvasStoreProvider>
          <ReactFlowProvider>
            <div className="p-6">
              <Story />
            </div>
          </ReactFlowProvider>
        </HarnessCanvasStoreProvider>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Output node for writing pipeline artifacts to a local filesystem path. The folder browser uses Canvas Storybook mock filesystem data.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof OutputLocalPathNode>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: "Local output node with path, file name, write mode, and description.",
      },
    },
  },
};

export const ErrorIfExists: Story = {
  args: {
    data: {
      label: "Write Protected Report",
      nodeType: "output-local-path",
      localPath: "/workspace/ordine/output",
      outputFileName: "review.md",
      outputMode: "error_if_exists",
      description: "Stops the run if the output file already exists.",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Warning state for the strict file-exists mode.",
      },
    },
  },
};
