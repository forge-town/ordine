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
    itemIndex: 0,
  },
};
