import type { Meta, StoryObj } from "@storybook/react";
import { OperationDetailPage } from "./OperationDetailPage";

const meta: Meta<typeof OperationDetailPage> = {
  title: "Pages/OperationDetailPage",
  component: OperationDetailPage,
};

export default meta;
type Story = StoryObj<typeof OperationDetailPage>;

export const Default: Story = {};
