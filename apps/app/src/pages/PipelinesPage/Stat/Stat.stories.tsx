import type { Meta, StoryObj } from "@storybook/react";
import { Layers } from "lucide-react";
import { Stat } from "./Stat";

const meta: Meta<typeof Stat> = {
  title: "Pages/PipelinesPage/Stat",
  component: Stat,
};

export default meta;
type Story = StoryObj<typeof Stat>;

export const Default: Story = {
  args: { icon: Layers, label: "节点数", value: 5 },
};
