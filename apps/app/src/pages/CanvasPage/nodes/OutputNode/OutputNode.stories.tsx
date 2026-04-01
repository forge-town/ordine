import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { OutputNode } from "./OutputNode";

const meta: Meta<typeof OutputNode> = {
  title: "HarnessCanvas/OutputNode",
  component: OutputNode,
  decorators: [
    (Story) => (
      <ReactFlowProvider>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </ReactFlowProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OutputNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "output",
      label: "最终报告",
      expectedSchema: "{ summary: string, score: number, keywords: string[] }",
      notes: "输出传递给下游通知系统",
    },
  },
};

export const Selected: Story = {
  args: {
    data: {
      nodeType: "output",
      label: "分析结果",
      expectedSchema: "{ sentiment: string, confidence: number }",
    },
    selected: true,
  },
};

export const MinimalData: Story = {
  args: {
    data: {
      nodeType: "output",
      label: "输出节点",
    },
  },
};

export const WithNotesOnly: Story = {
  args: {
    data: {
      nodeType: "output",
      label: "通知发送",
      notes: "触发邮件通知",
    },
  },
};
