import type { Meta, StoryObj } from "@storybook/react";
import { OperationDetailPageContent } from "./OperationDetailPageContent";

const meta: Meta<typeof OperationDetailPageContent> = {
  title: "Pages/OperationDetailPage/OperationDetailPageContent",
  component: OperationDetailPageContent,
};

export default meta;
type Story = StoryObj<typeof OperationDetailPageContent>;

export const Default: Story = {
  args: { operation: null },
};
