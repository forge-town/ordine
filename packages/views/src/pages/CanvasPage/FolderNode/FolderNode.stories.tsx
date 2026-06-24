import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasPageStoreProvider } from "../_store";
import { FolderNode } from "./FolderNode";

const meta: Meta<typeof FolderNode> = {
  title: "CanvasPage/FolderNode",
  component: FolderNode,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <CanvasPageStoreProvider>
        <ReactFlowProvider>
          <div style={{ padding: 24 }}>
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
          "Canvas node card for a folder object. Stories cover configured, selected, and empty-path states.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story: "Folder node with a local folder path and description.",
      },
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
  parameters: {
    docs: {
      description: {
        story: "Selected folder node state.",
      },
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
  parameters: {
    docs: {
      description: {
        story: "New folder node before a folder path has been selected.",
      },
    },
  },
};
