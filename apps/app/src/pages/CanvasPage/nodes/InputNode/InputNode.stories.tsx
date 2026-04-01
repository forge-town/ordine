import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { InputNode } from "./InputNode";

const meta: Meta<typeof InputNode> = {
  title: "HarnessCanvas/InputNode",
  component: InputNode,
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
type Story = StoryObj<typeof InputNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "input",
      label: "用户输入",
      contextDescription: "来自用户的请求信息",
      exampleValue: '{ "query": "hello world" }',
    },
  },
};

export const Selected: Story = {
  args: {
    data: {
      nodeType: "input",
      label: "系统提示词",
      contextDescription: "注入给模型的系统级指令",
    },
    selected: true,
  },
};

export const NoExampleValue: Story = {
  args: {
    data: {
      nodeType: "input",
      label: "文档上传",
      contextDescription: "用户上传的 PDF 或文本文件内容",
    },
  },
};
