import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CodeFileNode } from "./CodeFileNode";

const meta: Meta<typeof CodeFileNode> = {
  title: "HarnessCanvas/CodeFileNode",
  component: CodeFileNode,
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
type Story = StoryObj<typeof CodeFileNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "code-file",
      label: "main.ts",
      filePath: "src/main.ts",
      language: "typescript",
      description: "应用入口文件",
    },
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    data: {
      nodeType: "code-file",
      label: "canvasSlice.ts",
      filePath: "src/pages/CanvasPage/_store/canvasSlice.ts",
      language: "typescript",
    },
  },
};

export const NoPath: Story = {
  args: {
    data: {
      nodeType: "code-file",
      label: "新文件",
      filePath: "",
      language: "python",
    },
  },
};
