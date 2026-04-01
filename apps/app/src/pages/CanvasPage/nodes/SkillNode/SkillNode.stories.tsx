import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { SkillNode } from "./SkillNode";

const meta: Meta<typeof SkillNode> = {
  title: "HarnessCanvas/SkillNode",
  component: SkillNode,
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
type Story = StoryObj<typeof SkillNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "文本摘要",
      skillName: "summarize-text",
      acceptanceCriteria: "输出不超过100字，保留关键信息",
      status: "idle",
    },
  },
};

export const Running: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "情感分析",
      skillName: "sentiment-analysis",
      status: "running",
    },
  },
};

export const Pass: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "关键词提取",
      skillName: "keyword-extraction",
      acceptanceCriteria: "提取至少5个关键词",
      status: "pass",
    },
  },
};

export const Fail: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "翻译",
      skillName: "translate",
      status: "fail",
    },
  },
};

export const NoSkillName: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "未配置技能",
      skillName: "",
      status: "idle",
    },
  },
};

export const Selected: Story = {
  args: {
    data: {
      nodeType: "skill",
      label: "文本摘要",
      skillName: "summarize-text",
      status: "pass",
    },
    selected: true,
  },
};
