import type { Meta, StoryObj } from "@storybook/react";
import { OutputItemRow } from "./OutputItemRow";

const meta: Meta<typeof OutputItemRow> = {
  title: "Pages/OperationDetailPage/OutputItemRow",
  component: OutputItemRow,
};

export default meta;
type Story = StoryObj<typeof OutputItemRow>;

export const Default: Story = {
  args: {
    item: {
      name: "result",
      contentType: "markdown",
      description: "分析结果文件",
      templateIds: [],
    },
  },
};
