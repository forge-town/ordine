import type { Meta, StoryObj } from "@storybook/react";
import { Box, Wand2, ShieldCheck, LogOut } from "lucide-react";
import { NodeCard } from "./NodeCard";

const meta: Meta<typeof NodeCard> = {
  title: "HarnessCanvas/NodeCard",
  component: NodeCard,
  args: {
    icon: Box,
    label: "Example Node",
  },
};

export default meta;
type Story = StoryObj<typeof NodeCard>;

export const Default: Story = {
  args: {},
};

export const Emerald: Story = {
  args: { theme: "emerald", icon: Box, label: "Input Node" },
};

export const Violet: Story = {
  args: { theme: "violet", icon: Wand2, label: "Skill Node" },
};

export const Amber: Story = {
  args: { theme: "amber", icon: ShieldCheck, label: "Condition Node" },
};

export const Sky: Story = {
  args: { theme: "sky", icon: LogOut, label: "Output Node" },
};

export const Selected: Story = {
  args: {
    theme: "violet",
    icon: Wand2,
    label: "Selected Node",
    selected: true,
  },
};

export const WithBody: Story = {
  args: {
    theme: "emerald",
    icon: Box,
    label: "Node with Body",
    bodyClassName: "space-y-2",
    children: (
      <p className="text-xs leading-relaxed text-gray-600">Some context description here.</p>
    ),
  },
};

export const WithHeaderRight: Story = {
  args: {
    theme: "violet",
    icon: Wand2,
    label: "Node with Status",
    headerRight: <span className="text-[10px] font-medium text-green-500">✓ Pass</span>,
  },
};

export const AllThemes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <NodeCard theme="emerald" icon={Box} label="Input" />
      <NodeCard theme="violet" icon={Wand2} label="Skill" />
      <NodeCard theme="amber" icon={ShieldCheck} label="Condition" />
      <NodeCard theme="sky" icon={LogOut} label="Output" />
    </div>
  ),
};
