import type { Meta, StoryObj } from "@storybook/react";
import { AppearanceSection } from "./AppearanceSection";

const meta: Meta<typeof AppearanceSection> = {
  title: "Pages/SettingsPage/sections/AppearanceSection",
  component: AppearanceSection,
};

export default meta;

type Story = StoryObj<typeof AppearanceSection>;

export const Default: Story = {
  args: {
    values: { theme: "light" },
    onChange: () => {},
    onSave: () => {},
    saved: false,
  },
};
