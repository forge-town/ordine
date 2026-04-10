import type { Meta, StoryObj } from "@storybook/react";
import { SaveButton } from "./SaveButton";

const meta: Meta<typeof SaveButton> = {
  title: "Pages/SettingsPage/components/SaveButton",
  component: SaveButton,
};

export default meta;

type Story = StoryObj<typeof SaveButton>;

export const Default: Story = {
  args: { saved: false, onSave: () => {} },
};

export const Saved: Story = {
  args: { saved: true, onSave: () => {} },
};
