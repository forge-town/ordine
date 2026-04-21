import type { Meta, StoryObj } from "@storybook/react";
import { OutputPortRow } from "./OutputPortRow";

const meta: Meta<typeof OutputPortRow> = {
  title: "Pages/OperationDetailPage/OutputPortRow",
  component: OutputPortRow,
};

export default meta;
type Story = StoryObj<typeof OutputPortRow>;

export const Default: Story = {
  args: {
    port: {
      name: "result",
      kind: "file",
      path: "/output/result.json",
      description: "分析结果文件",
    },
  },
};
