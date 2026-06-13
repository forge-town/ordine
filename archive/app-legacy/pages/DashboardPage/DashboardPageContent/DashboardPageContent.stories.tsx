import type { Meta, StoryObj } from "@storybook/react";
import { DashboardPageContent } from "./DashboardPageContent";

const meta: Meta<typeof DashboardPageContent> = {
  title: "DashboardPage/DashboardPageContent",
  component: DashboardPageContent,
};
export default meta;
type Story = StoryObj<typeof DashboardPageContent>;

export const Default: Story = {};
