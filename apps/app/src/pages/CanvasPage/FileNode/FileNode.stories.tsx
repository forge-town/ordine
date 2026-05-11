import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { FileNode } from "./FileNode";

const meta: Meta<typeof FileNode> = {
  title: "HarnessCanvas/FileNode",
  component: FileNode,
  tags: ["autodocs"],
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
  parameters: {
    docs: {
      description: {
        component:
          "Canvas node card for a single source file object. Use these stories to check path display, inline editing, selection state, and empty-path fallback.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FileNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "file",
      label: "main.ts",
      filePath: "src/main.ts",
      language: "typescript",
      description: "应用入口文件",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Code-file node with path, language, and description populated.",
      },
    },
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    data: {
      nodeType: "file",
      label: "canvasSlice.ts",
      filePath: "src/pages/CanvasPage/_store/canvasSlice.ts",
      language: "typescript",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Selected file node state inside a React Flow context.",
      },
    },
  },
};

export const NoPath: Story = {
  args: {
    data: {
      nodeType: "file",
      label: "新文件",
      filePath: "",
      language: "python",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "New file node before a file path has been selected.",
      },
    },
  },
};
