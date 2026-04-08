import type { Meta, StoryObj } from "@storybook/react";
import { InputPortRow } from "./InputPortRow";

const meta: Meta<typeof InputPortRow> = {
  title: "Pages/OperationDetailPage/InputPortRow",
  component: InputPortRow,
};

export default meta;
type Story = StoryObj<typeof InputPortRow>;

export const Default: Story = {
  args: {
    port: {
      name: "source_file",
      kind: "file",
      required: true,
      description: "需要分析的源文件",
    },
  },
};

export const Optional: Story = {
  args: {
    port: {
      name: "config",
      kind: "text",
      required: false,
      description: "可选配置参数",
    },
  },
};
