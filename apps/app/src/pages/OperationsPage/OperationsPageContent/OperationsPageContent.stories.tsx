import type { Meta, StoryObj } from "@storybook/react";
import { OperationsPageContent } from "./OperationsPageContent";

const meta: Meta<typeof OperationsPageContent> = {
  title: "Pages/OperationsPage/OperationsPageContent",
  component: OperationsPageContent,
};

export default meta;
type Story = StoryObj<typeof OperationsPageContent>;

export const Default: Story = {
  args: { initialOperations: [] },
};
