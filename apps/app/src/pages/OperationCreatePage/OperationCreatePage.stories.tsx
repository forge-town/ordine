import type { Meta, StoryObj } from "@storybook/react";
import { OperationCreatePage } from "./OperationCreatePage";

const meta: Meta<typeof OperationCreatePage> = {
  title: "Pages/OperationCreatePage",
  component: OperationCreatePage,
};

export default meta;
type Story = StoryObj<typeof OperationCreatePage>;

export const Default: Story = {};
