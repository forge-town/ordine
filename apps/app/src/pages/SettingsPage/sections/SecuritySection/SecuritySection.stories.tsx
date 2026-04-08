import type { Meta, StoryObj } from "@storybook/react";
import { SecuritySection } from "./SecuritySection";

const meta: Meta<typeof SecuritySection> = {
  title: "Pages/SettingsPage/sections/SecuritySection",
  component: SecuritySection,
};

export default meta;

type Story = StoryObj<typeof SecuritySection>;

export const Default: Story = {
  args: {
    values: { currentPassword: "", newPassword: "", confirmPassword: "" },
    onChange: () => {},
    onSave: () => {},
    saved: false,
  },
};
