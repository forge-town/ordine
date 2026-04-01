import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { FolderNode } from "./FolderNode";

const meta: Meta<typeof FolderNode> = {
  title: "HarnessCanvas/FolderNode",
  component: FolderNode,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <div style={{ padding: 24 }}>
            <Story />
          </div>
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FolderNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "folder",
      label: "src",
      folderPath: "apps/app/src",
      description: "应用源码目录",
    },
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    data: {
      nodeType: "folder",
      label: "components",
      folderPath: "apps/app/src/components",
    },
  },
};

export const NoPath: Story = {
  args: {
    data: {
      nodeType: "folder",
      label: "新文件夹",
      folderPath: "",
    },
  },
};
