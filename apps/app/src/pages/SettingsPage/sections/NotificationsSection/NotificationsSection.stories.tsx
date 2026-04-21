import type { Meta, StoryObj } from "@storybook/react";
import { NotificationsSection } from "./NotificationsSection";

const meta: Meta<typeof NotificationsSection> = {
  title: "Pages/SettingsPage/sections/NotificationsSection",
  component: NotificationsSection,
};

export default meta;

type Story = StoryObj<typeof NotificationsSection>;

export const Default: Story = {
  args: {
    values: { pipeline: true, mention: false, weekly: false },
    onChange: () => {},
    onSave: () => {},
    saved: false,
  },
};
