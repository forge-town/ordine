import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { ConditionNode } from "./ConditionNode";

const meta: Meta<typeof ConditionNode> = {
  title: "HarnessCanvas/ConditionNode",
  component: ConditionNode,
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
type Story = StoryObj<typeof ConditionNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "质量检查",
      expression: "score >= 0.8",
      expectedResult: "通过质量阈值",
      status: "idle",
    },
  },
};

export const Running: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "相关性验证",
      expression: "relevance > 0.7",
      expectedResult: "内容相关",
      status: "running",
    },
  },
};

export const Pass: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "长度检查",
      expression: "length <= 500",
      expectedResult: "不超过500字",
      status: "pass",
    },
  },
};

export const Fail: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "格式验证",
      expression: "isValidJson(output)",
      expectedResult: "合法 JSON",
      status: "fail",
    },
  },
};

export const NoExpression: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "未配置条件",
      expression: "",
      expectedResult: "",
      status: "idle",
    },
  },
};

export const Selected: Story = {
  args: {
    data: {
      nodeType: "condition",
      label: "质量检查",
      expression: "score >= 0.8",
      expectedResult: "通过",
      status: "pass",
    },
    selected: true,
  },
};
