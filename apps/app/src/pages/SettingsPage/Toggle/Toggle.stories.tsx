import type { Meta, StoryObj } from "@storybook/react";
import { Toggle } from "./Toggle";

const meta: Meta<typeof Toggle> = {
  title: "Pages/SettingsPage/components/Toggle",
  component: Toggle,
};

export default meta;

type Story = StoryObj<typeof Toggle>;

export const Default: Story = {
  args: {
    enabled: false,
    label: "开启通知",
    onToggle: () => {},
  },
};

export const Enabled: Story = {
  args: {
    enabled: true,
    label: "开启通知",
    onToggle: () => {},
  },
};
