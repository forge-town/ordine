import type { Meta, StoryObj } from "@storybook/react";
import { Layers } from "lucide-react";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "DashboardPage/StatCard",
  component: StatCard,
  args: {
    icon: Layers,
    label: "Pipelines",
    sub: "已设计的流水线",
    to: "/pipelines",
    value: 5,
  },
};
export default meta;
type Story = StoryObj<typeof StatCard>;
export const Default: Story = { args: {} };
export const Zero: Story = { args: { value: 0 } };
