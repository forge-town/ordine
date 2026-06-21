import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Pages/JobsPage/StatCard",
  component: StatCard,
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: {
    color: "text-blue-700",
    dot: "bg-blue-500",
    label: "运行中",
    value: 3,
  },
};

export const Zero: Story = {
  args: {
    color: "text-gray-700",
    dot: "bg-gray-400",
    label: "排队中",
    value: 0,
  },
};

export const Failed: Story = {
  args: {
    color: "text-red-700",
    dot: "bg-red-500",
    label: "失败",
    value: 1,
  },
};
