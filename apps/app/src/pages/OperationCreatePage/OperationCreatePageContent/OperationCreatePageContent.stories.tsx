import type { Meta, StoryObj } from "@storybook/react";
import { OperationCreatePageContent } from "./OperationCreatePageContent";

const meta: Meta<typeof OperationCreatePageContent> = {
  title: "Pages/OperationCreatePage/OperationCreatePageContent",
  component: OperationCreatePageContent,
};

export default meta;
type Story = StoryObj<typeof OperationCreatePageContent>;

export const Default: Story = {};
