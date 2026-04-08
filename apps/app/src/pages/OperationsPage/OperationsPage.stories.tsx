import type { Meta, StoryObj } from "@storybook/react";
import { OperationsPage } from "./OperationsPage";

const meta: Meta<typeof OperationsPage> = {
  title: "Pages/OperationsPage",
  component: OperationsPage,
};

export default meta;
type Story = StoryObj<typeof OperationsPage>;

export const Default: Story = {};
